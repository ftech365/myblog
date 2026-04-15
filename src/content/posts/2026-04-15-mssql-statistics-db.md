---
title: "SQL Server で Statistics_DB を構築する — 目的・設計・活用事例まで"
description: "DMVの揮発性を補うために Statistics_DB を作成・運用する方法を解説。目的・テーブル設計・収集SP・AG構成の注意点・活用事例まで網羅する。"
pubDate: 2026-04-15
tags: ["SQL Server", "MSSQL", "パフォーマンス監視", "DBA", "待機統計"]
category: "SQL Server"
draft: false
featured: false
---

## はじめに

SQL Server の運用において、パフォーマンス問題の調査や傾向分析をしようとしたとき、
DMV（動的管理ビュー）のデータがインスタンス再起動でリセットされていた——という経験はないだろうか。

そこで活用されるのが **Statistics_DB**（統計データベース）だ。
SQL Server の組み込み機能ではなく、**運用者が独自に作成するパフォーマンス情報の永続化ストア**である。
本記事では、その目的から設計・運用・活用事例まで一気に整理する。

---

## 目次

- [Statistics_DB とは何か](#statistics_db-とは何か)
- [収集対象と処理フロー](#収集対象と処理フロー)
- [テーブル設計と収集SP](#テーブル設計と収集sp)
- [権限設計の考え方](#権限設計の考え方)
- [AG構成での注意事項](#ag構成での注意事項)
- [その他の注意事項](#その他の注意事項)
- [情報活用事例](#情報活用事例)
- [まとめ](#まとめ)

---

## Statistics_DB とは何か

Statistics_DB は以下の情報を一元的に蓄積するための専用データベースだ。

| 用途 | 収集元 DMV |
|------|-----------|
| 待機統計（Wait Stats）| `sys.dm_os_wait_stats` |
| クエリパフォーマンス | `sys.dm_exec_query_stats` |
| インデックス使用状況 | `sys.dm_db_index_usage_stats` |
| I/O 統計 | `sys.dm_io_virtual_file_stats` |
| Job 実行履歴 | `msdb.dbo.sysjobhistory` |

> **ポイント**: DMV はインスタンス再起動でリセットされる。長期的な傾向分析には外部への定期スナップショットが不可欠だ。

---

## 収集対象と処理フロー

収集は SQL Server Agent Job が定期的に DMV を参照し、Statistics_DB へ INSERT する構成をとる。

```
[監視対象インスタンス]
       │
       │  SQL Server Agent Job（定期実行）
       ▼
[DMV / システムビュー参照]
       │
       │  INSERT ※tbl_job_history のみ重複排除を考慮
       ▼
[Statistics_DB]
  ├─ tbl_wait_stats
  ├─ tbl_query_stats
  ├─ tbl_index_usage
  ├─ tbl_io_stats
  └─ tbl_job_history
       │
       ▼
[分析・レポーティング]
  SSRS / Excel / Power BI / Grafana
```

基本操作は INSERT（スナップショットの積み上げ）だ。MERGE が有効なのは `tbl_job_history` のみで、
同一 Job＋実行日時の二重取り込みを防ぐ目的で使用する。
wait_stats / io_stats / query_stats / index_usage は時系列での差分分析が目的のため、
同じ内容を上書きする概念がなく INSERT で十分だ。

収集頻度の目安は以下のとおりだ。

| テーブル | 推奨収集間隔 |
|---------|------------|
| tbl_wait_stats | 5〜15分 |
| tbl_io_stats | 15〜30分 |
| tbl_query_stats | 30分〜1時間 |
| tbl_index_usage | 1日1回（深夜） |
| tbl_job_history | 1日1回（深夜） |

---

## テーブル設計と収集SP

### データベース作成

<details>
<summary>データベース作成クエリを見る</summary>

```sql
CREATE DATABASE Statistics_DB
ON PRIMARY (
    NAME       = N'Statistics_DB',
    FILENAME   = N'D:\MSSQL\Data\Statistics_DB.mdf',
    SIZE       = 1024MB,
    FILEGROWTH = 512MB
)
LOG ON (
    NAME       = N'Statistics_DB_log',
    FILENAME   = N'E:\MSSQL\Log\Statistics_DB_log.ldf',
    SIZE       = 256MB,
    FILEGROWTH = 128MB
);

-- 統計データは再収集可能なため SIMPLE 推奨
-- AG 対象にする場合は FULL に変更すること
ALTER DATABASE Statistics_DB SET RECOVERY SIMPLE;
```

</details>

---

### tbl_wait_stats（待機統計）

`sys.dm_os_wait_stats` からスナップショットを定期取得する。
収集 SP では `SLEEP_TASK` や `BROKER_TO_FLUSH` など無害な待機種別を除外する。
全量を入れると分析ノイズになるため、除外リストの整備は設計初期から行っておくべきだ。

<details>
<summary>テーブル作成クエリを見る</summary>

```sql
USE Statistics_DB;
GO

CREATE TABLE dbo.tbl_wait_stats (
    snapshot_id         BIGINT        IDENTITY(1,1) NOT NULL,
    snapshot_time       DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    server_name         NVARCHAR(128) NOT NULL DEFAULT @@SERVERNAME,
    wait_type           NVARCHAR(60)  NOT NULL,
    waiting_tasks_count BIGINT        NOT NULL,
    wait_time_ms        BIGINT        NOT NULL,
    max_wait_time_ms    BIGINT        NOT NULL,
    signal_wait_time_ms BIGINT        NOT NULL,
    CONSTRAINT PK_wait_stats PRIMARY KEY CLUSTERED (snapshot_id)
);

CREATE NONCLUSTERED INDEX IX_wait_stats_time_type
    ON dbo.tbl_wait_stats (snapshot_time, wait_type);
```

</details>

<details>
<summary>収集SPクエリを見る</summary>

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Collect_WaitStats
AS
BEGIN
    SET NOCOUNT ON;

    -- AG 構成でセカンダリの場合はスキップ
    IF EXISTS (
        SELECT 1 FROM sys.databases
        WHERE name = 'Statistics_DB' AND replica_id IS NOT NULL
    )
    AND sys.fn_hadr_is_primary_replica('Statistics_DB') = 0
    BEGIN
        RAISERROR('Secondary replica - skipping WaitStats collection', 10, 1);
        RETURN;
    END

    INSERT INTO dbo.tbl_wait_stats (
        wait_type,
        waiting_tasks_count,
        wait_time_ms,
        max_wait_time_ms,
        signal_wait_time_ms
    )
    SELECT
        wait_type,
        waiting_tasks_count,
        wait_time_ms,
        max_wait_time_ms,
        signal_wait_time_ms
    FROM sys.dm_os_wait_stats
    WHERE wait_type NOT IN (
        'SLEEP_TASK', 'BROKER_TO_FLUSH', 'WAITFOR',
        'REQUEST_FOR_DEADLOCK_SEARCH', 'SQLTRACE_BUFFER_FLUSH',
        'CLR_AUTO_EVENT', 'DISPATCHER_QUEUE_SEMAPHORE',
        'XE_DISPATCHER_WAIT', 'XE_TIMER_EVENT',
        'CHECKPOINT_QUEUE', 'SP_SERVER_DIAGNOSTICS_SLEEP',
        'FT_IFTS_SCHEDULER_IDLE_WAIT', 'BROKER_EVENTHANDLER',
        'DBMIRROR_EVENTS_QUEUE', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
        'ONDEMAND_TASK_QUEUE', 'SERVER_IDLE_CHECK',
        'HADR_WORK_QUEUE', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION'
    );
END
GO
```

</details>

---

### tbl_query_stats（クエリ統計）

クエリハッシュ単位で実行時間・CPU・論理読み取りを蓄積する。
収集対象として保持するカラムは以下だ。

- `query_hash` / `query_plan_hash`：同一クエリの時系列追跡に使用
- `statement_text`：`sql_handle` と `statement_offset` から切り出して保存
- `execution_count`：実行回数の急増検知に使用
- `total_elapsed_time_us`：経過時間（マイクロ秒）
- `total_worker_time_us`：CPU 時間（マイクロ秒）
- `total_logical_reads` / `total_physical_reads`：I/O 負荷の把握
- `creation_time`：プランキャッシュ生成時刻。Plan Regression の発生タイミング特定に有効

収集対象は「直近1時間以内に実行されたもの」または「平均実行時間が1秒超のもの」に絞ると
データ量を抑えつつ重要なクエリを確実に捕捉できる。

<details>
<summary>テーブル作成クエリを見る</summary>

```sql
USE Statistics_DB;
GO

CREATE TABLE dbo.tbl_query_stats (
    snapshot_id           BIGINT        IDENTITY(1,1) NOT NULL,
    snapshot_time         DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    server_name           NVARCHAR(128) NOT NULL DEFAULT @@SERVERNAME,
    sql_handle            VARBINARY(64) NOT NULL,
    plan_handle           VARBINARY(64) NOT NULL,
    query_hash            BINARY(8)     NULL,
    query_plan_hash       BINARY(8)     NULL,
    statement_text        NVARCHAR(MAX) NULL,
    execution_count       BIGINT        NOT NULL,
    total_elapsed_time_us BIGINT        NOT NULL,
    total_worker_time_us  BIGINT        NOT NULL,
    total_logical_reads   BIGINT        NOT NULL,
    total_logical_writes  BIGINT        NOT NULL,
    total_physical_reads  BIGINT        NOT NULL,
    total_rows            BIGINT        NOT NULL,
    creation_time         DATETIME2(0)  NULL,
    CONSTRAINT PK_query_stats PRIMARY KEY CLUSTERED (snapshot_id)
);

CREATE NONCLUSTERED INDEX IX_query_stats_time
    ON dbo.tbl_query_stats (snapshot_time);

CREATE NONCLUSTERED INDEX IX_query_stats_hash
    ON dbo.tbl_query_stats (query_hash, snapshot_time);
```

</details>

<details>
<summary>収集SPクエリを見る</summary>

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Collect_QueryStats
AS
BEGIN
    SET NOCOUNT ON;

    -- AG 構成でセカンダリの場合はスキップ
    IF EXISTS (
        SELECT 1 FROM sys.databases
        WHERE name = 'Statistics_DB' AND replica_id IS NOT NULL
    )
    AND sys.fn_hadr_is_primary_replica('Statistics_DB') = 0
    BEGIN
        RAISERROR('Secondary replica - skipping QueryStats collection', 10, 1);
        RETURN;
    END

    INSERT INTO dbo.tbl_query_stats (
        sql_handle,
        plan_handle,
        query_hash,
        query_plan_hash,
        statement_text,
        execution_count,
        total_elapsed_time_us,
        total_worker_time_us,
        total_logical_reads,
        total_logical_writes,
        total_physical_reads,
        total_rows,
        creation_time
    )
    SELECT
        qs.sql_handle,
        qs.plan_handle,
        qs.query_hash,
        qs.query_plan_hash,
        -- statement_offset を使って対象ステートメントのみ切り出す
        SUBSTRING(
            st.text,
            (qs.statement_start_offset / 2) + 1,
            (
                CASE qs.statement_end_offset
                    WHEN -1 THEN DATALENGTH(st.text)
                    ELSE qs.statement_end_offset
                END - qs.statement_start_offset
            ) / 2 + 1
        )                    AS statement_text,
        qs.execution_count,
        qs.total_elapsed_time,
        qs.total_worker_time,
        qs.total_logical_reads,
        qs.total_logical_writes,
        qs.total_physical_reads,
        qs.total_rows,
        qs.creation_time
    FROM sys.dm_exec_query_stats qs
    CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
    WHERE qs.execution_count > 0
      AND (
          -- 直近1時間以内に実行されたもの
          qs.last_execution_time >= DATEADD(HOUR, -1, GETDATE())
          -- または平均実行時間が1秒超のもの
          OR qs.total_elapsed_time / NULLIF(qs.execution_count, 0) > 1000000
      );
END
GO
```

</details>

---

### tbl_index_usage（インデックス使用状況）

`sys.dm_db_index_usage_stats` はインスタンス再起動でリセットされるため、
毎日深夜にスナップショットを取得して累積値を蓄積する。
収集対象として保持するカラムは以下だ。

- `user_seeks` / `user_scans` / `user_lookups`：参照系の利用状況
- `user_updates`：更新コストの把握。seeks がゼロでも updates が多ければ無駄なインデックスだ
- `last_user_seek` / `last_user_scan`：最終利用日時。長期未使用インデックスの特定に使う
- `index_name` / `table_name` / `schema_name`：対象オブジェクトの識別

> **ポイント**: 収集 SP は動的 SQL でユーザー DB を対象として走査する。`database_id <= 4` のシステム DB は除外すること。

<details>
<summary>テーブル作成クエリを見る</summary>

```sql
USE Statistics_DB;
GO

CREATE TABLE dbo.tbl_index_usage (
    snapshot_id     BIGINT        IDENTITY(1,1) NOT NULL,
    snapshot_time   DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    server_name     NVARCHAR(128) NOT NULL DEFAULT @@SERVERNAME,
    database_id     INT           NOT NULL,
    database_name   NVARCHAR(128) NOT NULL,
    object_id       INT           NOT NULL,
    schema_name     NVARCHAR(128) NULL,
    table_name      NVARCHAR(128) NOT NULL,
    index_id        INT           NOT NULL,
    index_name      NVARCHAR(128) NULL,         -- NULL = HEAP
    index_type_desc NVARCHAR(60)  NOT NULL,
    user_seeks      BIGINT        NOT NULL,
    user_scans      BIGINT        NOT NULL,
    user_lookups    BIGINT        NOT NULL,
    user_updates    BIGINT        NOT NULL,
    last_user_seek  DATETIME2(0)  NULL,
    last_user_scan  DATETIME2(0)  NULL,
    last_user_lookup DATETIME2(0) NULL,
    last_user_update DATETIME2(0) NULL,
    CONSTRAINT PK_index_usage PRIMARY KEY CLUSTERED (snapshot_id)
);

CREATE NONCLUSTERED INDEX IX_index_usage_time_db
    ON dbo.tbl_index_usage (snapshot_time, database_name, table_name);
```

</details>

<details>
<summary>収集SPクエリを見る</summary>

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Collect_IndexUsage
AS
BEGIN
    SET NOCOUNT ON;

    -- AG 構成でセカンダリの場合はスキップ
    IF EXISTS (
        SELECT 1 FROM sys.databases
        WHERE name = 'Statistics_DB' AND replica_id IS NOT NULL
    )
    AND sys.fn_hadr_is_primary_replica('Statistics_DB') = 0
    BEGIN
        RAISERROR('Secondary replica - skipping IndexUsage collection', 10, 1);
        RETURN;
    END

    -- ユーザー DB を動的に対象とする
    DECLARE @sql NVARCHAR(MAX) = N'';

    SELECT @sql += N'
        INSERT INTO Statistics_DB.dbo.tbl_index_usage (
            database_id, database_name, object_id, schema_name, table_name,
            index_id, index_name, index_type_desc,
            user_seeks, user_scans, user_lookups, user_updates,
            last_user_seek, last_user_scan, last_user_lookup, last_user_update
        )
        SELECT
            ius.database_id,
            DB_NAME(ius.database_id),
            ius.object_id,
            s.name,
            o.name,
            ius.index_id,
            i.name,
            i.type_desc,
            ius.user_seeks,
            ius.user_scans,
            ius.user_lookups,
            ius.user_updates,
            ius.last_user_seek,
            ius.last_user_scan,
            ius.last_user_lookup,
            ius.last_user_update
        FROM sys.dm_db_index_usage_stats ius
        JOIN [' + name + '].sys.objects o
            ON ius.object_id = o.object_id
        JOIN [' + name + '].sys.indexes i
            ON ius.object_id = i.object_id
            AND ius.index_id = i.index_id
        JOIN [' + name + '].sys.schemas s
            ON o.schema_id = s.schema_id
        WHERE ius.database_id = DB_ID(''' + name + ''')
          AND o.type = ''U'';
    '
    FROM sys.databases
    WHERE database_id > 4           -- システム DB 除外
      AND state_desc = 'ONLINE'
      AND is_read_only = 0;

    EXEC sp_executesql @sql;
END
GO
```

</details>

---

### tbl_io_stats（I/O 統計）

`sys.dm_io_virtual_file_stats` からデータファイル・ログファイル単位の
読み書きレイテンシと転送量を収集する。
収集対象として保持するカラムは以下だ。

- `io_stall_read_ms` / `num_of_reads`：読み取りレイテンシの算出に使用
- `io_stall_write_ms` / `num_of_writes`：書き込みレイテンシの算出に使用
- `io_stall_ms`：合計待機時間
- `num_of_bytes_read` / `num_of_bytes_written`：スループットの把握
- `size_on_disk_bytes`：ファイル使用量の推移追跡
- `file_name`（`sys.master_files` より）：物理パス。ディスク分離判断の根拠になる

<details>
<summary>テーブル作成クエリを見る</summary>

```sql
USE Statistics_DB;
GO

CREATE TABLE dbo.tbl_io_stats (
    snapshot_id          BIGINT        IDENTITY(1,1) NOT NULL,
    snapshot_time        DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    server_name          NVARCHAR(128) NOT NULL DEFAULT @@SERVERNAME,
    database_id          INT           NOT NULL,
    database_name        NVARCHAR(128) NOT NULL,
    file_id              INT           NOT NULL,
    file_name            NVARCHAR(260) NOT NULL,
    file_type_desc       NVARCHAR(60)  NOT NULL,     -- ROWS / LOG
    num_of_reads         BIGINT        NOT NULL,
    num_of_bytes_read    BIGINT        NOT NULL,
    io_stall_read_ms     BIGINT        NOT NULL,
    num_of_writes        BIGINT        NOT NULL,
    num_of_bytes_written BIGINT        NOT NULL,
    io_stall_write_ms    BIGINT        NOT NULL,
    io_stall_ms          BIGINT        NOT NULL,
    size_on_disk_bytes   BIGINT        NOT NULL,
    CONSTRAINT PK_io_stats PRIMARY KEY CLUSTERED (snapshot_id)
);

CREATE NONCLUSTERED INDEX IX_io_stats_time_db
    ON dbo.tbl_io_stats (snapshot_time, database_name);
```

</details>

<details>
<summary>収集SPクエリを見る</summary>

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Collect_IOStats
AS
BEGIN
    SET NOCOUNT ON;

    -- AG 構成でセカンダリの場合はスキップ
    IF EXISTS (
        SELECT 1 FROM sys.databases
        WHERE name = 'Statistics_DB' AND replica_id IS NOT NULL
    )
    AND sys.fn_hadr_is_primary_replica('Statistics_DB') = 0
    BEGIN
        RAISERROR('Secondary replica - skipping IOStats collection', 10, 1);
        RETURN;
    END

    INSERT INTO dbo.tbl_io_stats (
        database_id,
        database_name,
        file_id,
        file_name,
        file_type_desc,
        num_of_reads,
        num_of_bytes_read,
        io_stall_read_ms,
        num_of_writes,
        num_of_bytes_written,
        io_stall_write_ms,
        io_stall_ms,
        size_on_disk_bytes
    )
    SELECT
        vfs.database_id,
        DB_NAME(vfs.database_id),
        vfs.file_id,
        mf.physical_name,
        mf.type_desc,
        vfs.num_of_reads,
        vfs.num_of_bytes_read,
        vfs.io_stall_read_ms,
        vfs.num_of_writes,
        vfs.num_of_bytes_written,
        vfs.io_stall_write_ms,
        vfs.io_stall,
        vfs.size_on_disk_bytes
    FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs
    JOIN sys.master_files mf
        ON  vfs.database_id = mf.database_id
        AND vfs.file_id     = mf.file_id;
END
GO
```

</details>

---

### tbl_job_history（Job 実行履歴）

`msdb.dbo.sysjobhistory` の `run_date` / `run_time` / `run_duration` はいずれも
YYYYMMDD / HHMMSS の数値形式で格納されているため、DATE / TIME / 秒数に変換して保存する。
このテーブルのみ MERGE または NOT EXISTS による重複チェックが有効だ。
同一 Job＋実行日時の二重取り込みを防ぐためだ。

<details>
<summary>テーブル作成クエリを見る</summary>

```sql
USE Statistics_DB;
GO

CREATE TABLE dbo.tbl_job_history (
    snapshot_id      BIGINT           IDENTITY(1,1) NOT NULL,
    collected_time   DATETIME2(0)     NOT NULL DEFAULT SYSUTCDATETIME(),
    server_name      NVARCHAR(128)    NOT NULL DEFAULT @@SERVERNAME,
    job_id           UNIQUEIDENTIFIER NOT NULL,
    job_name         NVARCHAR(128)    NOT NULL,
    step_id          INT              NOT NULL,
    step_name        NVARCHAR(128)    NOT NULL,
    run_date         DATE             NOT NULL,
    run_time         TIME(0)          NOT NULL,
    run_duration_sec INT              NOT NULL,
    run_status       TINYINT          NOT NULL,  -- 0:失敗 1:成功 2:再試行 3:キャンセル
    run_status_desc  NVARCHAR(20)     NOT NULL,
    message          NVARCHAR(1024)   NULL,
    CONSTRAINT PK_job_history PRIMARY KEY CLUSTERED (snapshot_id)
);

CREATE NONCLUSTERED INDEX IX_job_history_job_date
    ON dbo.tbl_job_history (job_name, run_date, step_id);
```

</details>

<details>
<summary>収集SPクエリを見る</summary>

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Collect_JobHistory
AS
BEGIN
    SET NOCOUNT ON;

    -- AG 構成でセカンダリの場合はスキップ
    IF EXISTS (
        SELECT 1 FROM sys.databases
        WHERE name = 'Statistics_DB' AND replica_id IS NOT NULL
    )
    AND sys.fn_hadr_is_primary_replica('Statistics_DB') = 0
    BEGIN
        RAISERROR('Secondary replica - skipping JobHistory collection', 10, 1);
        RETURN;
    END

    -- 直近2日分を対象・重複レコードは INSERT しない
    INSERT INTO dbo.tbl_job_history (
        job_id,
        job_name,
        step_id,
        step_name,
        run_date,
        run_time,
        run_duration_sec,
        run_status,
        run_status_desc,
        message
    )
    SELECT
        j.job_id,
        j.name,
        h.step_id,
        h.step_name,
        -- run_date：YYYYMMDD 数値 → DATE 変換
        CAST(
            CAST(h.run_date / 10000       AS VARCHAR(4)) + '-' +
            RIGHT('0' + CAST(h.run_date % 10000 / 100 AS VARCHAR(2)), 2) + '-' +
            RIGHT('0' + CAST(h.run_date % 100         AS VARCHAR(2)), 2)
        AS DATE),
        -- run_time：HHMMSS 数値 → TIME 変換
        CAST(
            RIGHT('0' + CAST(h.run_time / 10000       AS VARCHAR(2)), 2) + ':' +
            RIGHT('0' + CAST(h.run_time % 10000 / 100 AS VARCHAR(2)), 2) + ':' +
            RIGHT('0' + CAST(h.run_time % 100         AS VARCHAR(2)), 2)
        AS TIME(0)),
        -- run_duration：HHMMSS 数値 → 秒換算
        (h.run_duration / 10000 * 3600)
        + (h.run_duration % 10000 / 100 * 60)
        + (h.run_duration % 100),
        h.run_status,
        CASE h.run_status
            WHEN 0 THEN 'Failed'
            WHEN 1 THEN 'Succeeded'
            WHEN 2 THEN 'Retry'
            WHEN 3 THEN 'Cancelled'
            ELSE        'Unknown'
        END,
        LEFT(h.message, 1024)
    FROM msdb.dbo.sysjobhistory h
    JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
    WHERE h.run_date >= CAST(
        REPLACE(CAST(DATEADD(DAY, -2, GETDATE()) AS DATE), '-', '') AS INT
    )
    AND NOT EXISTS (
        SELECT 1 FROM dbo.tbl_job_history t
        WHERE t.job_id   = j.job_id
          AND t.step_id  = h.step_id
          AND t.run_date = CAST(
                CAST(h.run_date / 10000       AS VARCHAR(4)) + '-' +
                RIGHT('0' + CAST(h.run_date % 10000 / 100 AS VARCHAR(2)), 2) + '-' +
                RIGHT('0' + CAST(h.run_date % 100         AS VARCHAR(2)), 2)
              AS DATE)
          AND t.run_time = CAST(
                RIGHT('0' + CAST(h.run_time / 10000       AS VARCHAR(2)), 2) + ':' +
                RIGHT('0' + CAST(h.run_time % 10000 / 100 AS VARCHAR(2)), 2) + ':' +
                RIGHT('0' + CAST(h.run_time % 100         AS VARCHAR(2)), 2)
              AS TIME(0))
    );
END
GO
```

</details>

---

### クリーンアップ SP

古いデータを定期削除する共通 SP だ。Agent Job の日次バッチ末尾に組み込む。

<details>
<summary>クリーンアップSPクエリを見る</summary>

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Cleanup_OldData
    @retention_days INT = 90    -- デフォルト 90 日保持
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @cutoff DATETIME2 = DATEADD(DAY, -@retention_days, SYSUTCDATETIME());

    DELETE FROM dbo.tbl_wait_stats  WHERE snapshot_time < @cutoff;
    DELETE FROM dbo.tbl_query_stats WHERE snapshot_time < @cutoff;
    DELETE FROM dbo.tbl_index_usage WHERE snapshot_time < @cutoff;
    DELETE FROM dbo.tbl_io_stats    WHERE snapshot_time < @cutoff;

    -- job_history は run_date ベースで削除
    DELETE FROM dbo.tbl_job_history
    WHERE run_date < CAST(DATEADD(DAY, -@retention_days, GETDATE()) AS DATE);
END
GO
```

</details>

---

### Agent Job 構成

頻度別に Job をまとめるのが管理しやすい。

```
Job：Statistics_Collect_5min
  └─ usp_Collect_WaitStats
  └─ usp_Collect_IOStats

Job：Statistics_Collect_30min
  └─ usp_Collect_QueryStats

Job：Statistics_Collect_Daily（02:00）
  └─ usp_Collect_IndexUsage
  └─ usp_Collect_JobHistory
  └─ usp_Cleanup_OldData（デフォルト90日保持）
```

---

## 権限設計の考え方

収集処理は **収集専用アカウント** に分離し、業務アカウントは Statistics_DB に触れない構成が正しい。

```
業務アカウント
  └─ 業務 DB のみ操作（Statistics_DB へのアクセス権なし）

収集専用アカウント（SQL Agent Job 実行ユーザー）
  ├─ VIEW SERVER STATE（DMV 参照）
  └─ Statistics_DB：INSERT / EXECUTE のみ
```

業務アカウントへの Statistics_DB 権限付与は不要だ。
「収集もできる業務アカウント」にしてしまうと権限の意図が不明確になるため避ける。

---

## AG構成での注意事項

### FO アカウントへの権限設定

AG 構成では FO（フェイルオーバー）後に別ノードで Agent Job が動くため、
**両ノードに収集アカウントの権限を設定**しておかなければならない。
片方だけ設定すると FO 後に Job がエラーになる——よくある見落としだ。

### SQL 認証の SID 一致

Windows 認証（ドメインアカウント）であれば SID は自動で一致するが、
SQL 認証の場合はセカンダリ側で SID を明示指定して作成する必要がある。

```sql
-- セカンダリ側での作成例
CREATE LOGIN [collection_user] WITH PASSWORD = 'xxxx',
    SID = 0x/* プライマリ側の SID をコピー */;
```

### Statistics_DB を AG 対象にする場合

AG に参加させる場合は復旧モデルが `FULL` 必須になり、ログ生成量が増える。
容量設計を見直し、FO 後の Job 二重起動を防ぐガードを全収集 SP に入れておく。

```sql
IF sys.fn_hadr_is_primary_replica('Statistics_DB') = 0
BEGIN
    RAISERROR('Secondary replica - skipping collection', 10, 1);
    RETURN;
END
```

### Statistics_DB を AG 対象にしない場合

両ノードそれぞれにローカルの Statistics_DB を作成し、
同一の権限設定・Job・SP を配置する必要がある。構成管理の手間は増えるが
ログの肥大化は避けられる。

---

## その他の注意事項

収集処理自体が監視対象インスタンスに I/O・CPU 負荷を与えることを忘れてはならない。
Resource Governor でリソース制限をかける、またはピーク時間帯を避けたスケジューリングが有効だ。

データ量についても考慮が必要だ。Wait Stats を5分ごとに取ると1年で数千万件になり得る。
月次パーティション分割を初期設計に組み込んでおくと運用が楽になる。

また、SQL Server 2016 以降の **Query Store** が有効な場合は
クエリ統計の収集と役割が重複する。用途を整理して二重収集にならないようにしたい。

---

## 情報活用事例

---

### 待機統計によるボトルネック特定

主要な待機種別と注意閾値の目安は以下のとおりだ。

| 待機種別 | 意味 | 注意閾値の目安 |
|---------|------|--------------|
| `PAGEIOLATCH_SH/EX` | ディスク I/O 待ち | 平均待機 > **50ms** |
| `LCK_M_XX` | ロック競合 | 件数が継続的に増加 |
| `CXPACKET / CXCONSUMER` | 並列クエリ同期待ち | 全体の **25%超** で MAXDOP 見直し |
| `WRITELOG` | ログ書き込み待ち | 平均待機 > **5ms** |
| `SOS_SCHEDULER_YIELD` | CPU 圧迫 | 増加傾向が継続 |

参照カラム：`wait_type` / `wait_time_ms` / `waiting_tasks_count` / `signal_wait_time_ms` / `snapshot_time`

<details>
<summary>分析クエリを見る</summary>

```sql
-- 前回スナップショットとの差分で待機種別ごとの増加量を確認
SELECT
    cur.wait_type,
    cur.wait_time_ms        - prv.wait_time_ms        AS delta_wait_ms,
    cur.waiting_tasks_count - prv.waiting_tasks_count AS delta_tasks,
    (cur.wait_time_ms - prv.wait_time_ms)
        / NULLIF(cur.waiting_tasks_count - prv.waiting_tasks_count, 0)
                                                       AS avg_wait_ms_per_task
FROM dbo.tbl_wait_stats cur
JOIN dbo.tbl_wait_stats prv
    ON  cur.wait_type     = prv.wait_type
    AND prv.snapshot_time = (
        SELECT MAX(snapshot_time)
        FROM   dbo.tbl_wait_stats
        WHERE  snapshot_time < cur.snapshot_time
    )
WHERE cur.snapshot_time = (SELECT MAX(snapshot_time) FROM dbo.tbl_wait_stats)
ORDER BY delta_wait_ms DESC;
```

</details>

---

### クエリパフォーマンス劣化の検知

同一クエリハッシュの実行時間推移を時系列で追うことで Plan Regression を早期発見できる。

| 指標 | アラート閾値の目安 | 疑うべき原因 |
|------|-----------------|------------|
| 平均実行時間 | 前週比 **+50%以上** | 実行計画の変化（Plan Regression） |
| 平均論理読み取り | 前週比 **+100%以上** | 統計情報の陳腐化・断片化 |
| 実行回数 | 前日比 **3倍以上** | アプリ側 N+1 問題 |
| 平均 CPU 時間 | **1,000ms 超が継続** | 並列化・インデックスの見直し |

参照カラム：`query_hash` / `total_elapsed_time_us` / `total_worker_time_us` / `total_logical_reads` / `execution_count` / `snapshot_time`

<details>
<summary>分析クエリを見る</summary>

```sql
-- 同一クエリハッシュの実行時間推移を確認
SELECT
    snapshot_time,
    query_hash,
    execution_count,
    total_elapsed_time_us / execution_count AS avg_elapsed_us,
    total_worker_time_us  / execution_count AS avg_cpu_us,
    total_logical_reads   / execution_count AS avg_logical_reads
FROM dbo.tbl_query_stats
WHERE query_hash = 0x/* 対象クエリのハッシュ */
ORDER BY snapshot_time;

-- 前週比で実行時間が 1.5 倍以上に悪化したクエリを抽出
SELECT
    cur.query_hash,
    cur.snapshot_time,
    cur.total_elapsed_time_us / cur.execution_count AS avg_elapsed_us_cur,
    prv.total_elapsed_time_us / prv.execution_count AS avg_elapsed_us_prv,
    CAST(
        (cur.total_elapsed_time_us / cur.execution_count) * 1.0
        / NULLIF(prv.total_elapsed_time_us / prv.execution_count, 0)
    AS DECIMAL(5,2))                                AS ratio
FROM dbo.tbl_query_stats cur
JOIN dbo.tbl_query_stats prv
    ON  cur.query_hash    = prv.query_hash
    AND prv.snapshot_time = DATEADD(WEEK, -1, cur.snapshot_time)
WHERE cur.snapshot_time >= DATEADD(HOUR, -1, GETDATE())
  AND cur.execution_count > 0
  AND prv.execution_count > 0
ORDER BY ratio DESC;
```

</details>

---

### インデックス使用状況の定期レビュー

90日間のスナップショットを集計し、不要インデックスの整理判断に使う。

| 状態 | seeks + scans | updates | 推奨アクション |
|------|--------------|---------|--------------|
| 完全に未使用 | 0 | 任意 | 削除候補 |
| ほぼ未使用 | < 10 / 90日 | > 100 | 削除検討（更新コストが無駄） |
| スキャン多・シーク少 | scans >> seeks | 任意 | カバリングインデックスへ見直し |

参照カラム：`user_seeks` / `user_scans` / `user_updates` / `index_name` / `table_name` / `snapshot_time`

<details>
<summary>分析クエリを見る</summary>

```sql
-- 90日間ほぼ参照されていないが更新コストだけ発生しているインデックスを抽出
SELECT
    database_name,
    table_name,
    index_name,
    MAX(user_seeks)   AS max_seeks,
    MAX(user_scans)   AS max_scans,
    MAX(user_updates) AS max_updates
FROM dbo.tbl_index_usage
WHERE snapshot_time >= DATEADD(DAY, -90, GETDATE())
GROUP BY database_name, table_name, index_name
HAVING MAX(user_seeks) + MAX(user_scans) < 10
   AND MAX(user_updates) > 100
ORDER BY max_updates DESC;

-- スキャンがシークを大幅に上回るインデックスを抽出（カバリング化の候補）
SELECT
    database_name,
    table_name,
    index_name,
    MAX(user_seeks) AS max_seeks,
    MAX(user_scans) AS max_scans,
    MAX(user_scans) - MAX(user_seeks) AS scan_seek_diff
FROM dbo.tbl_index_usage
WHERE snapshot_time >= DATEADD(DAY, -90, GETDATE())
GROUP BY database_name, table_name, index_name
HAVING MAX(user_scans) > MAX(user_seeks) * 10
ORDER BY scan_seek_diff DESC;
```

</details>

---

### I/O レイテンシによるディスク評価

ファイル単位のレイテンシ推移からディスク分離・RAID 見直しの判断材料を得られる。

| レイテンシ | 評価 | アクション |
|-----------|------|-----------|
| < 1ms | 最良（NVMe/SSD） | 問題なし |
| 1〜5ms | 良好（SSD） | 問題なし |
| 5〜20ms | 要注意 | ファイル分離・RAID 見直しを検討 |
| 20ms 超 | 問題あり | 即時調査。ディスク障害の前兆の可能性あり |

参照カラム：`io_stall_read_ms` / `io_stall_write_ms` / `num_of_reads` / `num_of_writes` / `file_name` / `snapshot_time`

<details>
<summary>分析クエリを見る</summary>

```sql
-- 直近24時間のファイル別平均レイテンシを確認
SELECT
    database_name,
    file_name,
    AVG(io_stall_read_ms  / NULLIF(num_of_reads,  0)) AS avg_read_latency_ms,
    AVG(io_stall_write_ms / NULLIF(num_of_writes, 0)) AS avg_write_latency_ms,
    SUM(num_of_bytes_read    / 1024.0 / 1024.0)       AS total_read_mb,
    SUM(num_of_bytes_written / 1024.0 / 1024.0)       AS total_write_mb
FROM dbo.tbl_io_stats
WHERE snapshot_time >= DATEADD(HOUR, -24, GETDATE())
GROUP BY database_name, file_name
ORDER BY avg_read_latency_ms DESC;
```

</details>

---

### 長期トレンドによるキャパシティプランニング

月次で I/O・待機統計の平均・ピークを集計し、ハードウェア増強時期を予測する。

| リソース | 継続注意ライン | 増強検討ライン |
|---------|-------------|--------------|
| CPU 使用率（平均） | **60%超** が 1 週間継続 | **80%超** が 3 日継続 |
| CPU 使用率（ピーク） | **90%超** が散発 | **90%超** が毎日発生 |
| PLE（Page Life Expectancy） | **300秒以下** | **100秒以下** が継続 |
| ディスク使用率 | **70%超** | **85%超**（拡張計画を即開始） |

参照カラム：`snapshot_time`（月次集計）/ `io_stall_ms` / `num_of_bytes_read` / `num_of_bytes_written`

<details>
<summary>分析クエリを見る</summary>

```sql
-- 月次 I/O トレンド集計
SELECT
    YEAR(snapshot_time)                         AS yr,
    MONTH(snapshot_time)                        AS mo,
    AVG(io_stall_ms)                            AS avg_io_stall_ms,
    MAX(io_stall_ms)                            AS peak_io_stall_ms,
    SUM(num_of_bytes_read    / 1024.0 / 1024.0) AS total_read_mb,
    SUM(num_of_bytes_written / 1024.0 / 1024.0) AS total_write_mb
FROM dbo.tbl_io_stats
GROUP BY YEAR(snapshot_time), MONTH(snapshot_time)
ORDER BY yr, mo;

-- 月次 Wait Stats トレンド（上位待機種別の推移）
SELECT
    YEAR(snapshot_time)      AS yr,
    MONTH(snapshot_time)     AS mo,
    wait_type,
    SUM(wait_time_ms)        AS total_wait_ms,
    SUM(waiting_tasks_count) AS total_tasks
FROM dbo.tbl_wait_stats
GROUP BY YEAR(snapshot_time), MONTH(snapshot_time), wait_type
ORDER BY yr, mo, total_wait_ms DESC;
```

</details>

---

### Job 実行履歴の異常検知

過去30日の平均に対して実行時間が 2 倍以上のジョブを抽出して異常を検知する。

| 条件 | 判断 |
|------|------|
| 実行時間が過去30日平均の **2倍以上** | ロック競合・断片化を疑う |
| 同一ジョブが **3回連続失敗** | 即時アラート通知 |
| 深夜バッチが定常終了時刻を **30分超過** | 翌朝業務への影響リスクとして通知 |

参照カラム：`job_name` / `run_date` / `run_duration_sec` / `run_status` / `run_status_desc`

<details>
<summary>分析クエリを見る</summary>

```sql
-- 過去30日平均の2倍以上かかったジョブを抽出
SELECT
    job_name,
    run_date,
    run_duration_sec,
    avg_duration_sec,
    CAST(run_duration_sec * 1.0
        / NULLIF(avg_duration_sec, 0) AS DECIMAL(5,2)) AS ratio
FROM (
    SELECT
        job_name,
        run_date,
        run_duration_sec,
        AVG(run_duration_sec) OVER (
            PARTITION BY job_name
            ORDER BY run_date
            ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING
        ) AS avg_duration_sec
    FROM dbo.tbl_job_history
    WHERE step_id = 0   -- ジョブ全体の集計行のみ対象
) t
WHERE CAST(run_duration_sec * 1.0
        / NULLIF(avg_duration_sec, 0) AS DECIMAL(5,2)) >= 2.0
ORDER BY run_date DESC;

-- 直近で3回連続失敗しているジョブを抽出
SELECT job_name
FROM (
    SELECT
        job_name,
        run_status,
        ROW_NUMBER() OVER (
            PARTITION BY job_name
            ORDER BY run_date DESC, run_time DESC
        ) AS rn
    FROM dbo.tbl_job_history
    WHERE step_id = 0
) t
WHERE rn <= 3
GROUP BY job_name
HAVING SUM(CASE WHEN run_status = 0 THEN 1 ELSE 0 END) = 3;
```

</details>

---

## まとめ

Statistics_DB の本質は「DMV の揮発性を補うための永続化ストア」だ。
設計時に決めるべき核心は下記の3点に集約される。

- **何を・どの頻度で収集するか**（スコープ定義）
- **どこに置くか**（同一 / 集中 / 冗長）
- **いつ消すか**（保持ポリシー）

加えて冗長構成では「FO アカウントの権限を両ノードに設定する」「Job の二重起動を防ぐ」の
2点を構築チェックリストに明示的に含めておくことを強く勧める。

収集したデータは待機統計・クエリ劣化・インデックス整理・I/O 評価・キャパシティプランニングと
幅広い用途に活用できる。まず `tbl_wait_stats` と `tbl_io_stats` から始めて、
運用の中で収集範囲を広げていくアプローチが現実的だ。
