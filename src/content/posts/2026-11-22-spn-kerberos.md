---
title: "SPN（Service Principal Name）とは — 役割・設定手順・サービスクラス・注意点"
description: "Kerberos認証の要となるSPNの役割、必要な場面、登録場所と参照のされ方、setspn・PowerShellでの設定手順、主なサービスクラス、重複や2026年のRC4廃止を含む注意点をまとめた。"
pubDate: 2026-11-22
tags: ["SPN", "Kerberos", "Active Directory", "setspn", "SQL Server", "IIS", "委任", "RC4"]
category: "WindowsServer"
draft: false
featured: false
---

## はじめに

Windowsドメイン環境で「統合認証がNTLMにフォールバックしてしまう」「ダブルホップで委任が効かない」といった問題に遭遇したとき、真っ先に疑うべきなのがSPN（Service Principal Name）である。本記事では、SPNの役割から設定手順、サービスクラスの一覧、設定時の注意点までを整理する。2026年に適用されたKerberosのRC4廃止（CVE-2026-20833）がSPN運用に与える影響も補足する。

---

## 目次

- [SPNとは](#spnとは)
- [SPNが必要になる場面](#spnが必要になる場面)
- [SPNの形式](#spnの形式)
- [サービスクラス一覧](#サービスクラス一覧)
- [SPNが設定される場所と参照のされ方](#spnが設定される場所と参照のされ方)
- [設定に必要な情報](#設定に必要な情報)
- [設定手順](#設定手順)
- [設定時の注意点](#設定時の注意点)
- [2026年時点の補足事項](#2026年時点の補足事項)
- [トラブルシューティング](#トラブルシューティング)
- [まとめ](#まとめ)
- [参考リンク](#参考リンク)

---

## SPNとは

SPNは、Kerberos認証において**サービスのインスタンスを一意に識別するための名前**である。クライアントがサービスへ接続する際、「接続先サービスがどのアカウントで動いているか」をドメインコントローラー（KDC）が特定するために使われる。

> **注意**: Microsoft Entra IDにも「サービスプリンシパル」という用語があるが、アプリケーションの識別オブジェクトを指す別概念である。本記事のSPNはActive DirectoryのKerberos認証における名前であり、混同しないこと。

---

## SPNが必要になる場面

Kerberos認証を使うあらゆる場面でSPNが必要になる。主な例は以下のとおりだ。

- SQL Serverへの統合認証（Windows認証）での接続
- IIS上のWebアプリへの統合Windows認証
- Exchange・SharePointなどのサービス間通信
- 委任（Delegation）を使う構成（IIS → SQL Serverのようなダブルホップ）

SPNが未登録、または誤っている場合、クライアントはKerberosを使えずNTLMにフォールバックする。NTLMでは委任が使えないため、ダブルホップ構成ではそのまま障害になる。

---

## SPNの形式

SPNは次の形式の文字列で表現する。

```text
サービスクラス/ホスト名[:ポート][/サービス名]
```

| 要素 | 説明 | 例 |
|---|---|---|
| サービスクラス | サービスの種別 | `MSSQLSvc`, `HTTP`, `host` |
| ホスト名 | FQDNまたはNetBIOS名 | `sql01.corp.example.com` |
| ポート | 省略可。非標準ポートや複数インスタンスの区別に使う | `1433` |

具体例は以下のとおりだ。

```text
MSSQLSvc/sql01.corp.example.com:1433
HTTP/webapp.corp.example.com
```

---

## サービスクラス一覧

サービスクラスはサービスの種類ごとに慣習的に決まっている。Microsoft製品では製品側が使うクラスが決まっており、独自の名前に変えてはいけない。主なMicrosoft系のクラスは以下のとおりだ。

| サービスクラス | 対象サービス |
|---|---|
| `MSSQLSvc` | SQL Serverデータベースエンジン |
| `MSOLAPSvc.3` | SQL Server Analysis Services |
| `HTTP` | IIS・Webアプリ全般（SSRSやWinRMのHTTP利用もこれを使う） |
| `host` | Windows標準サービス全般の代替（後述） |
| `cifs` | SMB・ファイル共有 |
| `TERMSRV` | リモートデスクトップ |
| `WSMAN` | WinRM・PowerShell Remoting |
| `ldap` / `gc` | Active Directory（LDAP・グローバルカタログ） |
| `DNS` | DNSサーバー |
| `exchangeMDB` / `SMTP` / `IMAP` / `POP` | Exchange関連 |
| `MSOMSdkSvc` | System Center Operations Manager |

サードパーティ・オープンソース系は、製品ごとに設定可能なサービス名のデフォルト値がクラスとして使われる。

| サービスクラス | 対象サービス |
|---|---|
| `HTTP` | Apache・nginxなどのWebサーバー |
| `postgres` | PostgreSQL |
| `kafka` | Apache Kafka |
| `nfs` | Linux NFS |
| `oracle` | Oracle Database |

> **ポイント**: Microsoftが全サービスクラスを網羅した単一の公式レジストリを公開しているわけではない。製品ごとのドキュメントでクラス名を確認するのが確実だ。

---

### hostクラスの特別な扱い

---

`host` は特殊なクラスで、多くのWindowsサービスの代替として機能する。ADの `sPNMappings` 属性に「`host` にマッピングされるサービスクラスの別名」が定義されており、`cifs` や `HTTP` などはこの別名にあたる。そのため、コンピューターアカウントに `host/マシン名` が登録されていれば、これらのクラスは個別登録がなくても解決される。

一方、`TERMSRV` と `WSMAN` は別名ではなく、コンピューターアカウントに既定で個別登録される。確認するとよい。

```powershell
setspn -L DOMAIN\PC01$
```

---

## SPNが設定される場所と参照のされ方

SPNは**Active Directory上のアカウントの `servicePrincipalName` 属性**に格納される。登録先は、サービスを実行しているアカウント（ドメインユーザー、gMSA、コンピューターアカウントなど）である。

Kerberos認証の流れの中で、SPNは次のように参照される。

```text
① クライアントが接続先ホスト名・ポートからSPNを組み立て、DCにサービスチケットを要求
        ↓
② DCがSPNを検索し、登録されているアカウントを特定
        ↓
③ DCがそのアカウントの鍵で暗号化したサービスチケット(TGS)を返す
        ↓
④ クライアントがサービスにチケットを提示 → 認証成功
```

クライアントが組み立てるSPNと、ADに登録されたSPNが一致しなければ認証は失敗する。

---

## 設定に必要な情報

SPNの登録前に、以下の情報を揃えておく。

| 情報 | 内容 |
|---|---|
| サービスクラス | `MSSQLSvc`、`HTTP` など |
| ホスト名（FQDN） | クライアントが接続時に使う名前。CNAMEやロードバランサー経由の場合はその名前 |
| ポート番号 | 非標準ポートや名前付きインスタンスの場合に必須 |
| 登録先アカウント | サービスを実際に実行しているアカウント |

> **ポイント**: 登録先は「サービスが実際に動いているアカウント」でなければならない。SQL Serverの場合は、SQL Serverのサービス起動アカウントがこれにあたる。

---

## 設定手順

---

### 事前確認

---

登録前に、既存のSPNと重複の有無を確認する。

```powershell
# 対象アカウントの既存SPN確認
setspn -L DOMAIN\svc_sql

# 登録予定のSPNを誰かが既に使っていないか検索
setspn -Q MSSQLSvc/sql01.corp.example.com:1433

# ドメイン内の重複チェック（フォレスト全体は -X -F）
setspn -X
```

---

### setspnで登録する

---

登録には `-A` ではなく **`-S`** を使う。`-S` は登録前に重複をチェックし、重複があれば登録を拒否する（`-A` は重複確認をしない）。

```powershell
# SQL Server（FQDN、ポートあり）
setspn -S MSSQLSvc/sql01.corp.example.com:1433 DOMAIN\svc_sql

# 既定インスタンスのポートなし版
setspn -S MSSQLSvc/sql01.corp.example.com DOMAIN\svc_sql

# 登録結果の確認
setspn -L DOMAIN\svc_sql
```

主なオプションは以下のとおりだ。

| オプション | 意味 |
|---|---|
| `-L` | 登録済みSPNの一覧表示 |
| `-Q` | SPNの検索 |
| `-X` | 重複SPNの検出 |
| `-S` | 重複確認付きで登録（推奨） |
| `-A` | 重複確認なしで登録 |
| `-D` | SPNの削除 |

---

### PowerShellで登録する

---

ADモジュールからも登録できる。

```powershell
Import-Module ActiveDirectory

# 追加
Set-ADUser svc_sql -ServicePrincipalNames @{
    Add = @(
        "MSSQLSvc/sql01.corp.example.com:1433",
        "MSSQLSvc/sql01.corp.example.com"
    )
}

# 削除
Set-ADUser svc_sql -ServicePrincipalNames @{
    Remove = "MSSQLSvc/sql01.corp.example.com:1433"
}

# 確認
Get-ADUser svc_sql -Properties ServicePrincipalNames |
    Select-Object -ExpandProperty ServicePrincipalNames
```

> **注意**: PowerShellの `Add` は重複チェックを行わない。登録前に `setspn -Q` で確認すること。

---

### SQL Serverの自動登録

---

SQL Serverはインスタンス起動時にSPNの自動登録を試み、停止時に削除を試みる。ただし、サービス起動アカウントにSPNを書き込む権限が必要である。

自動登録できるかどうかは、起動アカウントの種類で決まる。

- 仮想アカウント・管理サービスアカウント（MSA/gMSA）やビルトインアカウント（Local System等）は、SPNを自動登録できる
- 通常のドメインユーザーアカウントは、既定では書き込み権限がなく、手動登録が必要になる

通常のドメインユーザーで自動登録させたい場合は、ADUCで該当アカウントに「**Validated write to service principal name**」の権限を付与する方法もある。なお、ドメイン管理者での登録は本番環境では推奨されない。

---

### IIS（HTTP）の登録

---

アプリケーションプールIDにドメインアカウントを使う場合の例だ。

```powershell
# アプリプールのドメインアカウントに登録
setspn -S HTTP/webapp.corp.example.com DOMAIN\svc_web

# コンピューターアカウントで動かす場合
setspn -S HTTP/webapp.corp.example.com DOMAIN\WEB01$
```

> **注意**: IISのカーネルモード認証の設定によっては、アプリプールIDではなくコンピューターアカウントが復号に使われる。`useAppPoolCredentials` の設定と登録先アカウントを一致させること。

---

### 委任（Delegation）の設定

---

ダブルホップが必要な構成では、SPNの登録に加えて委任の設定が必要になる。制約付き委任はADUCの「委任」タブから設定できる。このタブは、アカウントにSPNが1つ以上登録されて初めて表示される。

PowerShellでは以下のとおりだ。

```powershell
# 制約付き委任（フロントエンド側に委任先SPNを指定）
Set-ADUser svc_web -Add @{
    "msDS-AllowedToDelegateTo" = "MSSQLSvc/sql01.corp.example.com:1433"
}
```

Windows Server 2012以降では、バックエンド側で許可するリソースベース制約付き委任（RBCD）も使える。

```powershell
# バックエンド(svc_sql)側で、svc_webからの委任を許可する
Set-ADUser svc_sql -PrincipalsAllowedToDelegateToAccount svc_web
```

> **注意**: 無制約委任（Unconstrained Delegation）は、そのアカウントに接続したユーザーのTGTを保持する仕組みで、侵害時の影響が大きい。使わずに制約付き委任またはRBCDを選ぶこと。

---

### 動作確認

---

設定後は、実際にKerberosで接続できているかを確認する。SQL Serverの場合は、接続後に以下のクエリで認証方式を確認できる。

```sql
SELECT auth_scheme
FROM sys.dm_exec_connections
WHERE session_id = @@SPID;
```

`KERBEROS` と表示されればKerberos認証で接続できている。`NTLM` ならSPNの不備を疑う。クライアント側では `klist` でチケットのキャッシュを確認できる。

```powershell
# 現在のチケット一覧
klist

# 特定SPNのチケットを取得して確認
klist get MSSQLSvc/sql01.corp.example.com:1433

# チケットのクリア（設定変更後の再テスト用）
klist purge
```

---

## 設定時の注意点

SPNの設定で特に押さえておくべき点を以下にまとめる。

| 注意点 | 内容 |
|---|---|
| 重複登録は厳禁 | 同一SPNが複数アカウントにあるとKerberos認証が失敗する。`-S` での登録と `setspn -X` での定期チェックを徹底する |
| 接続名と一致させる | クライアントが使う名前（FQDN・エイリアス・ロードバランサー名）でSPNを登録する。NetBIOS名での接続を許容する場合は短縮名も登録する |
| ポート・インスタンス変更時 | ポートや構成を変えたら古いSPNを削除し、新しいSPNを登録し直す |
| アカウント変更時 | サービスアカウントを変えたら、旧アカウントからSPNを削除して新アカウントへ登録する |
| 再インストール時の重複 | アカウント違いで再インストールしてSPNを再登録すると重複しやすい |
| クラスター・AG | フェールオーバークラスターのネットワーク名やAvailability Groupのリスナー名にも、サービス起動アカウントへのSPN登録が必要になる |
| 登録権限 | SPNの書き込みにはADの `servicePrincipalName` 属性への書き込み権限が必要。権限の委任で対応でき、ドメイン管理者である必要はない |
| 委任との組み合わせ | SPNが正しくなければ、委任も機能しない |

> **ポイント**: SPNの登録有無は「誰が見ても分かる状態」ではない。構成変更の際は、SPNの棚卸しを変更手順書に含めておくとよい。

---

## 2026年時点の補足事項

2026年1月以降のWindows更新プログラムで、Kerberos認証におけるRC4暗号の利用が段階的に廃止されている（CVE-2026-20833、KB5073381）。この変更はSPNを持つサービスアカウントに直接影響する。

経緯は以下のとおりだ。

| 時期 | 内容 |
|---|---|
| 2026年1月13日 | 初期展開フェーズ。KDCに監査イベント（KDCSVC 201〜209）が追加された |
| 2026年4月14日 | 適用フェーズ。`DefaultDomainSupportedEncTypes` の既定値がAES-SHA1のみ（`0x18`）に変更され、手動のロールバックが可能 |
| 2026年7月以降 | `RC4DefaultDisablementPhase` レジストリ値のサポートが削除され、適用モードが自動で有効化される |

つまり、`msDS-SupportedEncryptionTypes` 属性が未設定のサービスアカウントには、既定でAESで暗号化されたチケットだけが発行される。これによる影響は以下のとおりだ。

- AESキーを持たない古いサービスアカウント（パスワードを長期間変更していないアカウント）では、認証が失敗しうる
- RC4しか扱えない非Windowsのクライアント・サーバーとの相互運用に影響が出る
- 対応としては、サービスアカウントのパスワードをリセットしてAESキーを生成し、`msDS-SupportedEncryptionTypes` を明示的に設定する

```powershell
# AES128 + AES256 のみを許可（24 = 0x18）
Set-ADUser svc_sql -Replace @{"msDS-SupportedEncryptionTypes" = 24}

# 現在の設定確認
Get-ADUser svc_sql -Properties msDS-SupportedEncryptionTypes |
    Select-Object Name, msDS-SupportedEncryptionTypes
```

> **注意**: やむを得ずRC4を使い続ける場合は、対象サービスのアカウントで `msDS-SupportedEncryptionTypes` のビットマスクにRC4を明示的に含める必要がある。ただしRC4はサービスチケットへのオフライン攻撃（Kerberoasting）に弱いため、恒久対応にはしないこと。

なお、SPNを持つサービスアカウントはKerberoastingの標的になりやすい。長く複雑なパスワードの設定に加え、可能であればgMSA（パスワードの自動ローテーション）を使うことが望ましい。

---

## トラブルシューティング

Kerberos認証が通らない場合は、以下のログと観点で原因を切り分ける。

| 確認箇所 | 見るべき内容 |
|---|---|
| DCのセキュリティログ（イベントID 4769） | サービスチケット要求の成否。失敗コード `0x7` は該当SPNが未登録であることを示す |
| DCのシステムログ（KDC、イベントID 11） | 同一SPNが複数アカウントに存在する場合に記録される |
| 接続先サーバーのシステムログ（Kerberos、イベントID 4） | `KRB_AP_ERR_MODIFIED`。SPNの登録先アカウントと実行アカウントが不一致の場合に記録される |
| DCのシステムログ（Kdcsvc、イベントID 201〜209） | RC4関連の監査イベント（2026年以降） |
| クライアントの `klist` | 想定したSPNのチケットが取得できているか |

---

## まとめ

SPNの設定は、次の流れで進める。

```text
1. 実行アカウント・接続名・ポートを確認
2. setspn -Q / -X で既存SPNと重複を確認
3. setspn -S で登録
4. （必要なら）制約付き委任 / RBCD を設定
5. KERBEROS接続を確認し、RC4依存がないかも確認
```

SPNは「1つのSPNは1つのアカウントにだけ」「クライアントが組み立てる名前と一致させる」という2点を守れば、大半のトラブルは防げる。2026年以降は、サービスアカウントのAESキー対応も合わせて確認しておきたい。

---

## 参考リンク

- [Kerberos 接続用のサービス プリンシパル名の登録（Microsoft Learn）](https://learn.microsoft.com/ja-jp/sql/database-engine/configure-windows/register-a-service-principal-name-for-kerberos-connections)
- [Beyond RC4 for Windows authentication（Windows Server Blog）](https://www.microsoft.com/windows-server/blog/2025/12/03/beyond-rc4-for-windows-authentication/)
- [What changed in RC4 with the January 2026 Windows update（Microsoft Tech Community）](https://techcommunity.microsoft.com/t5/core-infrastructure-and-security/what-changed-in-rc4-with-the-january-2026-windows-update-and-why/ba-p/4504732)
