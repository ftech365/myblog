---
title: "SQL Server アカウント権限構成ガイド — SSMS設定とクエリ管理を完全整理"
description: "SQL ServerのUserMapping・ServerRole・Securableの設定項目と権限内容、さらに権限付与・確認クエリまでを体系的にまとめた解説記事。"
pubDate: 2026-04-01
tags: ["SQL Server", "権限管理", "SSMS", "セキュリティ", "T-SQL"]
category: "SQL Server"
draft: false
featured: false
---

## はじめに

SQL Serverの権限管理は、GUIであるSSMSと T-SQL クエリの両方から操作できる。
しかし設定箇所が複数に分散しているため、「どこで何を設定するのか」「どのロールが何を許可するのか」が把握しにくい。

この記事では、SSMSで設定できる **UserMapping・ServerRole・Securable** の3箇所を軸に、権限の種類・できること・クエリによる操作・確認方法を体系的に整理する。

---

## 目次

- [権限の階層構造](#権限の階層構造)
- [UserMapping — ユーザーとDBの紐付け](#usermapping--ユーザーとdbの紐付け)
- [ServerRole — サーバーレベルのロール](#serverrole--サーバーレベルのロール)
- [Securable — オブジェクト単位の権限](#securable--オブジェクト単位の権限)
- [クエリで権限を付与する](#クエリで権限を付与する)
- [クエリで権限を確認する](#クエリで権限を確認する)
- [まとめ](#まとめ)

---

## 権限の階層構造

SQL Serverの権限は、サーバー → データベース → オブジェクトという3層構造になっている。

```
サーバーレベル（ServerRole / Securable-Server）
  └─ インスタンス全体に作用
       └─ データベースレベル（UserMapping → DBロール / Securable-DB）
            └─ 各DBに作用
                 └─ オブジェクトレベル（Securable-Schema/Table/Proc）
                      └─ テーブル・列・プロシージャ単位で作用
```

上位の権限は下位を包含する。`sysadmin` を持つログインはすべてのDBのすべてのオブジェクトを操作できる。逆にオブジェクトレベルの権限は、そのオブジェクトにのみ有効だ。

---

## UserMapping — ユーザーとDBの紐付け

---

### 概要

SSMSの「ログインプロパティ」→「ユーザー マッピング」で設定する。
**ログイン（サーバー認証）とデータベースユーザーを結びつける**設定であり、マッピングがなければそのDBにアクセスできない。

---

### 設定項目

主な設定項目は以下のとおりだ。

| 設定項目 | 内容 |
|---|---|
| マップするデータベース | ログインをどのDBのユーザーとして登録するか。複数DB同時指定可。 |
| ユーザー名 | DB内のユーザー名。ログイン名と異なっていてもよい。 |
| 既定のスキーマ | オブジェクト名を修飾しない場合に使われるスキーマ。通常は `dbo`。 |
| データベースロールメンバーシップ | そのDB内でのロール割り当て。下表参照。 |

> **ポイント**: ユーザー名は後から変更しにくいため、最初に命名規則を決めておくことを推奨する。

---

### UserMapping画面内で設定できるDBロール一覧

ロールをチェックするだけで、権限セットをまとめて付与できる。

| ロール名 | 付与される権限（主なもの） |
|---|---|
| `db_owner` | DB内の全操作（スキーマ作成・削除・バックアップ含む）。最強権限。 |
| `db_securityadmin` | ロール管理・権限 GRANT/REVOKE。メンバー自身の権限昇格に悪用リスクあり。 |
| `db_accessadmin` | DBへのログイン追加・削除。 |
| `db_backupoperator` | バックアップ実行（`BACKUP DATABASE` / `LOG`）。 |
| `db_ddladmin` | DDL全般（`CREATE`/`ALTER`/`DROP TABLE` 等）。データ読み書きは不可。 |
| `db_datawriter` | 全テーブルへの `INSERT` / `UPDATE` / `DELETE`。`SELECT` は不可。 |
| `db_datareader` | 全テーブルへの `SELECT` のみ。書き込み不可。 |
| `db_denydatawriter` | 全テーブルへの書き込みを明示的に拒否。他ロールの書き込み権限を上書きする。 |
| `db_denydatareader` | 全テーブルへの `SELECT` を明示的に拒否。 |
| `public` | 全ユーザーが自動メンバー。デフォルトは最小限の権限のみ。 |

> **注意**: `db_denydatawriter` / `db_denydatareader` は DENY のため、他のロールで許可している権限より優先される。誤って付与しないよう注意が必要だ。

---

## ServerRole — サーバーレベルのロール

---

### 概要

SSMSの「セキュリティ」→「サーバー ロール」で確認・設定する。
**インスタンス全体**に影響する権限を付与するロールであり、DBをまたぐ操作が可能になる。

---

### 固定サーバーロール一覧

以下の9種類が固定で存在する。

| ロール名 | 付与される権限（主なもの） |
|---|---|
| `sysadmin` | インスタンス上のあらゆる操作。`sa` アカウントはデフォルトメンバー。 |
| `serveradmin` | サーバー設定変更（`sp_configure`）・シャットダウン。 |
| `securityadmin` | ログイン管理・サーバーレベル権限の GRANT/REVOKE。 |
| `processadmin` | プロセス終了（`KILL`）。実行中セッションを強制終了できる。 |
| `setupadmin` | リンクサーバー追加・削除。 |
| `bulkadmin` | `BULK INSERT` 実行権限。 |
| `diskadmin` | ディスクファイル管理（`sp_addumpdevice` 等）。 |
| `dbcreator` | DBの作成・変更・削除・復元。 |
| `public` | 全ログインが自動メンバー。最小限の参照権限のみ。 |

> **注意**: `sysadmin` はインスタンス全体の最高権限であるため、付与対象は最小限にとどめるべきだ。`securityadmin` も実質的に権限昇格が可能なため、同等のリスクがある。

---

## Securable — オブジェクト単位の権限

---

### 概要

ログインプロパティの「セキュリティ保護可能なリソース」タブ、またはDBユーザープロパティで設定する。
ロールを使わず、**オブジェクト単位で細粒度に権限を制御**したい場合に使用する。

設定には **許可（Grant）・拒否（Deny）・取り消し（Revoke）** の3状態があり、Deny は Grant より優先される。

---

### スコープ別の主な権限

以下のスコープに対してそれぞれ権限を設定できる。

| スコープ | 主な権限 | できること |
|---|---|---|
| サーバー全体 | `CONNECT SQL`, `VIEW SERVER STATE`, `ALTER ANY LOGIN`, `SHUTDOWN` | インスタンスへの接続・状態参照・ログイン管理などをロールを使わず個別付与。 |
| データベース | `CONNECT`, `CREATE TABLE/VIEW/PROCEDURE`, `BACKUP DATABASE`, `ALTER` | 特定DBへの接続・オブジェクト作成権限を細粒度で付与。 |
| スキーマ | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXECUTE`, `ALTER` | スキーマ配下の全オブジェクトに一括で権限付与。以降追加したオブジェクトにも自動適用。 |
| テーブル / ビュー | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `VIEW DEFINITION` | 列レベル制御も可能（SSMSからは設定困難なためクエリを推奨）。 |
| ストアドプロシージャ / 関数 | `EXECUTE`, `VIEW DEFINITION`, `ALTER` | プロシージャ実行権限のみを安全に渡せる。テーブルへの直接アクセス権は不要。 |

---

## クエリで権限を付与する

---

### GRANT — 権限の付与

主要な構文は以下のとおりだ。

```sql
-- テーブルへの SELECT 権限を付与
GRANT SELECT ON dbo.Orders TO user1;

-- 複数の権限を一度に付与
GRANT INSERT, UPDATE, DELETE ON dbo.Orders TO user1;

-- 列レベルで絞る（GUI では設定困難）
GRANT SELECT ON dbo.Orders (OrderID, Amount) TO user1;

-- ストアドプロシージャの実行のみ許可
GRANT EXECUTE ON dbo.usp_GetOrder TO user1;

-- スキーマ単位で一括付与（以降追加したオブジェクトにも有効）
GRANT SELECT ON SCHEMA::Sales TO user1;

-- サーバーレベル権限の個別付与
GRANT ALTER ANY LOGIN TO user1;

-- DB の全権限（db_owner 相当）をロールなしで付与
GRANT CONTROL ON DATABASE::MyDB TO user1;

-- 再付与権限を含めて付与（user1 が他者へ同権限を再付与できる）
GRANT SELECT ON dbo.Orders TO user1 WITH GRANT OPTION;
```

---

### DENY / REVOKE — 拒否と取り消し

```sql
-- 明示的拒否（ロールで DELETE を持っていても上書きブロック）
DENY DELETE ON dbo.Orders TO user1;

-- 付与・拒否を取り消す（何もない状態に戻す）
REVOKE SELECT ON dbo.Orders FROM user1;
```

> **注意**: `REVOKE` は DENY を解除しない。DENY を解除するには `REVOKE DENY` ではなく `REVOKE DELETE ON dbo.Orders FROM user1` を実行する必要がある。DENY 状態を完全にリセットしたい場合も同様だ。

---

### ロールへのメンバー追加

```sql
-- サーバーロールへのメンバー追加（sysadmin 権限が必要）
ALTER SERVER ROLE sysadmin ADD MEMBER user1;

-- DBロールへのメンバー追加
ALTER ROLE db_datareader ADD MEMBER user1;
```

---

## クエリで権限を確認する

---

### ログイン・サーバーレベルの確認

```sql
-- サーバー上の全ログイン一覧
SELECT name, type_desc, is_disabled, default_database_name, create_date
FROM   sys.server_principals
WHERE  type IN ('S','U','G')  -- S=SQL認証 U=Windows U G=Windowsグループ
ORDER BY name;

-- サーバーロールのメンバー一覧
SELECT r.name AS role_name, m.name AS member_name
FROM   sys.server_role_members rm
JOIN   sys.server_principals r ON r.principal_id = rm.role_principal_id
JOIN   sys.server_principals m ON m.principal_id = rm.member_principal_id
ORDER BY r.name, m.name;

-- 特定ログインのサーバーレベル権限
SELECT permission_name, state_desc
FROM   sys.server_permissions sp
JOIN   sys.server_principals p ON p.principal_id = sp.grantee_principal_id
WHERE  p.name = N'確認したいログイン名';
```

---

### DB ユーザー・DBロールの確認

対象DBに `USE` してから実行する。

```sql
-- DB内のユーザー一覧（ログインとの対応付き）
SELECT u.name AS db_user, l.name AS login_name,
       u.type_desc, u.default_schema_name
FROM   sys.database_principals u
LEFT JOIN sys.server_principals l ON l.sid = u.sid
WHERE  u.type IN ('S','U','G')
ORDER BY u.name;

-- DBロールのメンバー一覧
SELECT r.name AS role_name, m.name AS member_name
FROM   sys.database_role_members rm
JOIN   sys.database_principals r ON r.principal_id = rm.role_principal_id
JOIN   sys.database_principals m ON m.principal_id = rm.member_principal_id
ORDER BY r.name, m.name;

-- 特定ユーザーが所属するDBロール一覧
SELECT r.name AS role_name
FROM   sys.database_role_members rm
JOIN   sys.database_principals r ON r.principal_id = rm.role_principal_id
JOIN   sys.database_principals m ON m.principal_id = rm.member_principal_id
WHERE  m.name = N'確認したいユーザー名';
```

---

### オブジェクト・スキーマ権限の確認

```sql
-- DB内の全オブジェクト権限一覧
SELECT p.name        AS principal_name,
       obj.name      AS object_name,
       obj.type_desc AS object_type,
       dp.permission_name,
       dp.state_desc
FROM   sys.database_permissions dp
JOIN   sys.database_principals  p   ON p.principal_id   = dp.grantee_principal_id
JOIN   sys.objects               obj ON obj.object_id     = dp.major_id
WHERE  dp.class_desc = 'OBJECT_OR_COLUMN'
ORDER BY p.name, obj.name;

-- 特定テーブルに対する権限を持つユーザー一覧
SELECT p.name AS principal_name, dp.permission_name, dp.state_desc
FROM   sys.database_permissions dp
JOIN   sys.database_principals  p   ON p.principal_id = dp.grantee_principal_id
JOIN   sys.objects               obj ON obj.object_id  = dp.major_id
WHERE  obj.name = N'テーブル名'
  AND  dp.class_desc = 'OBJECT_OR_COLUMN';

-- スキーマレベルの権限一覧
SELECT p.name AS principal_name, s.name AS schema_name,
       dp.permission_name, dp.state_desc
FROM   sys.database_permissions dp
JOIN   sys.database_principals  p ON p.principal_id = dp.grantee_principal_id
JOIN   sys.schemas               s ON s.schema_id    = dp.major_id
WHERE  dp.class_desc = 'SCHEMA'
ORDER BY p.name, s.name;
```

---

### ユーザーの実効権限を横断確認

```sql
-- 現在のユーザーが特定テーブルに何ができるか（1=あり 0=なし）
SELECT HAS_PERMS_BY_NAME(N'dbo.Orders', 'OBJECT', 'SELECT') AS can_select,
       HAS_PERMS_BY_NAME(N'dbo.Orders', 'OBJECT', 'INSERT') AS can_insert,
       HAS_PERMS_BY_NAME(N'dbo.Orders', 'OBJECT', 'UPDATE') AS can_update,
       HAS_PERMS_BY_NAME(N'dbo.Orders', 'OBJECT', 'DELETE') AS can_delete;

-- 現在の接続ユーザーが持つDB権限をすべて列挙
SELECT entity_name, subentity_name, permission_name
FROM   fn_my_permissions(NULL, 'DATABASE')
ORDER BY permission_name;

-- 別ユーザーの実効権限を確認（sysadmin 権限が必要）
EXECUTE AS USER = N'確認したいユーザー名';

SELECT entity_name, permission_name
FROM   fn_my_permissions(NULL, 'DATABASE');

REVERT;  -- 必ず元のコンテキストに戻す
```

> **注意**: `EXECUTE AS USER` 使用後は必ず `REVERT` を実行すること。実行コンテキストが切り替わったまま他の操作を行うと意図しない権限で実行される危険がある。

---

### 確認に使う主なシステムビュー・関数

以下のビューと関数を組み合わせることで、あらゆる権限調査に対応できる。

| ビュー / 関数名 | 用途 |
|---|---|
| `sys.server_principals` | サーバーレベルのログイン・ロール一覧 |
| `sys.server_permissions` | サーバーレベルの権限（GRANT/DENY） |
| `sys.server_role_members` | サーバーロールのメンバー構成 |
| `sys.database_principals` | DB内のユーザー・ロール一覧 |
| `sys.database_permissions` | DB内のオブジェクト・スキーマ権限 |
| `sys.database_role_members` | DBロールのメンバー構成 |
| `sys.objects` | テーブル・ビュー・プロシージャ等の一覧 |
| `sys.schemas` | スキーマ一覧 |
| `fn_my_permissions()` | 現在のユーザーの実効権限（ロール経由込み） |
| `HAS_PERMS_BY_NAME()` | 特定オブジェクトへの権限を 1/0 で返す関数 |

---

## まとめ

SQL Serverの権限管理における設定箇所と権限内容を整理した。
運用時は以下の3点を意識すると管理がシンプルになる。

- **最小権限の原則** — まず `db_datareader` + `db_datawriter` を基本とし、DDL・管理操作が必要な場合のみ追加付与する
- **DENY は最終手段** — DENY は Grant を上書きするため、予期しない権限剥奪の原因になりやすい。基本は Grant/Revoke で管理する
- **スキーマ単位 GRANT が効率的** — `GRANT SELECT ON SCHEMA::Sales TO user1` とすると、後から追加したテーブルにも自動で権限が適用される

---

## 参考リンク

- [SQL Server の固定データベース ロール — Microsoft Learn](https://learn.microsoft.com/ja-jp/sql/relational-databases/security/authentication-access/database-level-roles)
- [GRANT (Transact-SQL) — Microsoft Learn](https://learn.microsoft.com/ja-jp/sql/t-sql/statements/grant-transact-sql)
- [sys.database_permissions — Microsoft Learn](https://learn.microsoft.com/ja-jp/sql/relational-databases/system-catalog-views/sys-database-permissions-transact-sql)
- [fn_my_permissions — Microsoft Learn](https://learn.microsoft.com/ja-jp/sql/relational-databases/system-functions/sys-fn-my-permissions-transact-sql)
