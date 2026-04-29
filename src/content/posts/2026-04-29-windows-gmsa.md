---
title: "Windows gMSA（グループ管理サービスアカウント）完全ガイド — 仕組みから設定手順まで"
description: "Active Directory環境でサービスアカウントのパスワード管理を自動化するgMSAの概要・必要コンポーネント・AD側とクライアント側の設定手順・IIS/SQL Serverへの適用・トラブルシューティングを網羅的に解説する。"
pubDate: 2026-04-29
tags: ["gMSA", "ActiveDirectory", "WindowsServer", "IIS", "SQLServer", "セキュリティ"]
category: "WindowsServer"
draft: false
featured: false
---

## はじめに

Windowsサービスの実行アカウントとして通常のドメインユーザーを使っている場合、パスワードの有効期限切れによるサービス停止や、複数サーバーへのパスワード同期作業が運用上の悩みになりがちだ。

gMSA（Group Managed Service Account / グループ管理サービスアカウント）は、こうした課題をActive Directoryの仕組みで自動解決する機能である。本記事では、gMSAの概要から必要コンポーネント・AD側とクライアント側の設定手順・IIS/SQL Serverへの適用・トラブルシューティング・セキュリティのベストプラクティスまでを体系的に整理する。

---

## 目次

- [gMSAとは何か](#gmsa-とは何か)
- [必要コンポーネントと前提条件](#必要コンポーネントと前提条件)
- [設定の全体フロー](#設定の全体フロー)
- [AD側の設定手順](#ad-側の設定手順)
  - [初期環境構築（ドメイン全体で1回のみ）](#初期環境構築ドメイン全体で1回のみ)
  - [通常運用（gMSAを追加するたびに実施）](#通常運用gmsa-を追加するたびに実施)
- [クライアント（サーバー）側の設定手順](#クライアントサーバー側の設定手順)
- [IIS・SQL Serverへの適用手順](#iissql-server-への適用手順)
- [トラブルシューティング](#トラブルシューティング)
- [gMSA と sMSA（単体版）の違い](#gmsa-と-smsaの違い)
- [セキュリティのベストプラクティス](#セキュリティのベストプラクティス)
- [まとめ](#まとめ)

---

## gMSAとは何か

gMSAはWindows Server 2012で導入された、Active Directory管理下のサービス専用アカウントである。通常のドメインユーザーをサービスアカウントとして使う場合と比較すると、以下の点で大きく異なる。

| 比較項目 | 通常のドメインユーザー | gMSA |
|---|---|---|
| パスワード管理 | 手動（管理者が変更） | ADが自動ローテーション（既定30日） |
| パスワードの把握 | 管理者が知っている | 誰も知らない（ADのみ管理） |
| 複数サーバーでの利用 | パスワード同期が必要 | そのまま利用可能 |
| SPN管理 | 手動 | AD自動管理 |
| 対話ログオン | 可能 | 不可（サービス専用） |

主な特徴は以下のとおりだ。

- **パスワード自動ローテーション** — ADが30日ごとにパスワードを変更・同期する。管理者の手作業は不要
- **複数サーバー対応** — NLBやクラスター構成など、複数のサーバーで同一アカウントを安全に共有できる
- **Kerberos認証対応** — SPNをADが自動管理するため、Kerberos認証を使うサービスにも適している

---

## 必要コンポーネントと前提条件

### AD環境なら誰でも使える？ → 条件がある

gMSAを利用するには以下の条件をすべて満たす必要がある。

| 条件 | 要件 |
|---|---|
| ドメイン機能レベル | Windows Server 2012 以上 |
| DCのOS | Windows Server 2012 以上（最低1台） |
| クライアント（サーバー）のOS | Windows Server 2012 以上 / Windows 8 以上 |
| PowerShellモジュール | Active Directory module（RSAT） |

### Windowsの役割と機能で必要なもの

**ドメインコントローラー側**は `Active Directory Domain Services`（AD DS）のみでよく、追加のインストールは不要だ。gMSAはAD DSに含まれる機能として動作する。

**クライアント（サーバー）側**は `Remote Server Administration Tools (RSAT)` の中の **Active Directory module for PowerShell** が必要となる。

```powershell
# PowerShellでインストールする場合
Install-WindowsFeature RSAT-AD-PowerShell

# インストール確認
Get-Module -ListAvailable ActiveDirectory
```

GUIで追加する場合はサーバーマネージャー →「機能」→「リモートサーバー管理ツール」→「役割管理ツール」→「AD DS および AD LDS ツール」からインストールする。

---

## 設定の全体フロー

AD側とクライアント側の作業を分けて整理すると、以下のような流れになる。

```
【AD側の作業 — 初期環境構築（ドメイン全体で1回のみ）】
  ①  KDSルートキーの作成

【AD側の作業 — gMSA追加のたびに実施する通常運用】
  ②  許可グループの作成（gMSAを使うサーバーを管理するグループ）
  ③  gMSAアカウントの作成
  ④  SPN（サービスプリンシパル名）の追加（Kerberos利用時のみ）

【クライアント（サーバー）側の作業】
  ⑤  RSATモジュールのインストール
  ⑥  gMSAのインストール（Install-ADServiceAccount）
  ⑦  動作確認（Test-ADServiceAccount）
  ⑧  サービス・アプリへの適用
```

---

## AD側の設定手順

AD側の作業は「初期環境構築」と「通常運用」の2種類に分かれる。初期環境構築はドメイン全体で1回だけ実施するもので、以降のgMSA追加作業では不要だ。通常運用の手順は新しいgMSAを追加するたびに繰り返し実施する。

---

### 初期環境構築（ドメイン全体で1回のみ）

#### ① KDSルートキーの作成

KDSルートキーはgMSAのパスワード自動生成に使う暗号キーで、**ドメイン全体で1回だけ実施**する。すでに作成済みの場合はスキップしてよい。

```powershell
# 本番環境（10時間後に有効 ※全DCへの複製を待つため）
Add-KdsRootKey -EffectiveTime (Get-Date).AddHours(-10)

# テスト・検証環境（即時有効）
Add-KdsRootKey -EffectiveImmediately

# 作成確認
Get-KdsRootKey
```

> **注意**: DCが複数台ある場合、KDSルートキーが全DCに複製されるまで最大10時間かかる。本番環境では `-EffectiveImmediately` は使わないこと。

---

### 通常運用（gMSAを追加するたびに実施）

新しいgMSAを作成する際は以下の手順を繰り返す。許可グループがすでに存在する場合は②をスキップしてよい。

---

#### ② 許可グループの作成

gMSAを利用できるサーバーをセキュリティグループで管理する。個別のコンピューターアカウントを直接指定することも可能だが、グループで管理するほうが追加・削除が容易だ。

```powershell
# セキュリティグループの作成
New-ADGroup `
  -Name "gMSA-WebApp-Servers" `
  -GroupScope Global `
  -GroupCategory Security

# グループにサーバーのコンピューターアカウントを追加（末尾の $ が重要）
Add-ADGroupMember `
  -Identity "gMSA-WebApp-Servers" `
  -Members "WebServer01$", "WebServer02$"
```

> **ポイント**: グループ追加後、対象サーバーを**再起動**しないとKerberosチケットが更新されず、gMSAを取得できない。

---

#### ③ gMSAアカウントの作成

```powershell
New-ADServiceAccount `
  -Name "gMSA-WebApp" `
  -DNSHostName "webapp.example.com" `
  -PrincipalsAllowedToRetrieveManagedPassword "gMSA-WebApp-Servers" `
  -ManagedPasswordIntervalInDays 30
```

主なパラメーターは以下のとおりだ。

| パラメーター | 説明 |
|---|---|
| `-Name` | アカウント名（最大15文字、ADには末尾 `$` 付きで登録される） |
| `-DNSHostName` | サービスのFQDN。後から `Set-ADServiceAccount` で変更可能 |
| `-PrincipalsAllowedToRetrieveManagedPassword` | パスワード取得を許可するグループまたはコンピューター |
| `-ManagedPasswordIntervalInDays` | ローテーション間隔（**作成時のみ指定可能・後から変更不可**） |

> **ポイント**: `-DNSHostName` はKerberos認証（Windows統合認証・委任認証）を使用する場合にSPN解決で参照される。一般的なWebアプリやSQL認証のみの構成では意識不要で、まずはサーバーのFQDNを入れておけばよい。

---

#### ④ SPNの追加（Kerberos利用時のみ）

IISやSQL Serverなどでのケースでは、必要に応じてSPNを追加する。

```powershell
Set-ADServiceAccount `
  -Identity "gMSA-WebApp" `
  -ServicePrincipalNames @{Add="http/webapp.example.com"}
```

---

## クライアント（サーバー）側の設定手順 / 各サーバーで実施

以下の手順はすべて**対象サーバー1台ずつで個別に実行**する。以降の手順例では次の構成を前提とする。

```
[Active Directory]
  └── gMSA-WebApp$                       ← IIS用サービスアカウント
        使用許可グループ: gMSA-WebApp-Servers
              ├── WebServer01$
              └── WebServer02$

[WebServer01 / WebServer02]
  └── IIS アプリケーションプール
        実行ユーザー: gMSA-WebApp$
              サービス提供: webapp.example.com
```

---

### ⑤ RSATモジュールのインストール


```powershell
Install-WindowsFeature RSAT-AD-PowerShell
```

---

### ⑥ gMSAのインストール

ADから gMSA 情報を取得し、ローカルに登録する。

```powershell
Install-ADServiceAccount -Identity "gMSA-WebApp"
```

---

### ⑦ 動作確認

```powershell
Test-ADServiceAccount -Identity "gMSA-WebApp"
# True が返れば成功
```

動作確認が取れたら、各サービス（IIS・SQL Server等）へのアカウント適用に進む。

---

## IIS・SQL Serverへの適用手順

---

### IIS アプリケーションプール

IISへの適用は「関連フォルダへの権限付与」と「アプリケーションプールの実行ユーザー設定」の2つが必要だ。

まず gMSA にコンテンツフォルダ・ログフォルダへのアクセス権を付与する。

```powershell
icacls "C:\inetpub\wwwroot\MyApp" /grant "DOMAIN\gMSA-WebApp$:(OI)(CI)RX"
icacls "C:\inetpub\logs"          /grant "DOMAIN\gMSA-WebApp$:(OI)(CI)M"
```

次にアプリケーションプールの実行ユーザーに gMSA を指定する。パスワード欄は空白でよい。

```powershell
Import-Module WebAdministration

Set-ItemProperty "IIS:\AppPools\MyAppPool" `
  -Name processModel `
  -Value @{
    userName     = "DOMAIN\gMSA-WebApp$"
    password     = ""
    identitytype = 3
  }

Restart-WebAppPool -Name "MyAppPool"
```

> **ポイント**: GUIでパスワード空白のまま設定すると「パスワードが違います」エラーになることがある。その場合はPowerShellで設定すると回避できる。

---

### SQL Server サービス

SQL Serverへの適用は「関連フォルダへの権限付与」「SQL Server内でのログイン作成と権限付与」「サービスアカウントの設定」の3つが必要だ。

まずデータ・ログ・バックアップフォルダへのNTFS権限を付与する。

```powershell
icacls "D:\SQLData"   /grant "DOMAIN\gMSA-SqlSvc$:(OI)(CI)F"
icacls "D:\SQLLog"    /grant "DOMAIN\gMSA-SqlSvc$:(OI)(CI)F"
icacls "D:\SQLBackup" /grant "DOMAIN\gMSA-SqlSvc$:(OI)(CI)F"
```

次にSQL Server内にgMSAのログインを作成し、必要な権限を付与する。

```sql
CREATE LOGIN [DOMAIN\gMSA-SqlSvc$] FROM WINDOWS;
ALTER SERVER ROLE sysadmin ADD MEMBER [DOMAIN\gMSA-SqlSvc$];
```

最後にSQL Server構成マネージャーでサービスアカウントを変更する。「SQL Server のサービス」→ 対象サービスのプロパティ → ログオンタブ → `DOMAIN\gMSA-SqlSvc$` を指定し、パスワードは**空白**のまま適用・再起動する。

> **ポイント**: Windows認証を使用する場合・外部ドメインからの接続がある場合・リンクサーバーを使う場合はSPNの設定も必要になる。

---

## トラブルシューティング

### Test-ADServiceAccount が False を返す

原因として多いのは以下の3点だ。

- サーバーのコンピューターアカウントが許可グループに未追加
- グループ追加後にサーバーを再起動していない（Kerberosチケット未更新）
- KDSルートキーがまだ全DCに複製されていない

```powershell
# 許可グループのメンバーを確認
Get-ADGroupMember -Identity "gMSA-WebApp-Servers"

# KDSルートキーの状態を確認
Get-KdsRootKey
```

対処は「グループへの追加 → サーバー再起動 → 再度 `Test-ADServiceAccount`」の順に試すとよい。

---

### Install-ADServiceAccount でアクセス拒否エラー

```powershell
# gMSAの許可設定を確認
Get-ADServiceAccount -Identity "gMSA-WebApp" `
  -Properties PrincipalsAllowedToRetrieveManagedPassword |
  Select-Object PrincipalsAllowedToRetrieveManagedPassword
```

サーバーがグループに追加されているにもかかわらずエラーになる場合は、**再起動をしていないことが原因**であるケースがほとんどだ。

---

### IIS アプリケーションプールが起動しない（イベントID: 5059 / 5057）

原因として多いのは以下の3点だ。

- gMSAにフォルダへのアクセス権が付与されていない
- アカウント名の末尾 `$` を忘れている
- `Install-ADServiceAccount` が実行されていない

```powershell
# フォルダ権限の確認
icacls "C:\inetpub\wwwroot\MyApp"
```

---

### パスワードローテーション後にサービスが停止した

gMSAを使わず、パスワードをハードコードした古い設定が残っている場合に発生する。

```powershell
# パスワード最終更新日時を確認
Get-ADServiceAccount -Identity "gMSA-WebApp" `
  -Properties PasswordLastSet | Select-Object PasswordLastSet
```

サービスの設定をgMSAに切り替え、パスワード欄を空白にすることで解決する。

---

### SQL Serverサービスが起動しない（エラー 1069）

「サービスとしてログオン」権限が gMSA に付与されていない場合に発生する。SQL Server 構成マネージャーで設定し直すと自動的に権限が付与されることが多い。手動で確認する場合は以下のコマンドを使う。

```powershell
secedit /export /cfg C:\secpol.cfg
Get-Content C:\secpol.cfg | Select-String "SeServiceLogonRight"
```

---

## gMSA と sMSAの違い

sMSA（Managed Service Account）はWindows Server 2008 R2で導入されたgMSAの前身にあたるアカウントだ。主な違いは以下のとおりだ。

| 比較項目 | sMSA（v1） | gMSA（v2） |
|---|---|---|
| 正式名称 | Managed Service Account | Group Managed Service Account |
| 導入バージョン | Windows Server 2008 R2 | Windows Server 2012 |
| 使用可能サーバー数 | **1台のみ** | **複数台OK** |
| クラスター・NLB対応 | 不可 | 可能 |
| KDSルートキーが必要 | 不要 | 必要 |
| パスワード自動管理 | 自動 | 自動 |
| 現在の推奨 | 非推奨（レガシー） | **推奨** |

sMSAは1台のサーバーにしか紐付けられないため、スケールアウト構成（NLBやクラスター）では使えない。新規構築では迷わず gMSA を選択すべきだ。

---

## セキュリティのベストプラクティス

### 最小権限の原則を徹底する

gMSAには必要なフォルダ・サービスに対する最小限の権限のみを付与する。Domain Adminsなどの強力なグループに追加することは避けるべきだ。

```powershell
# 読み取り実行のみ（書き込み不要なフォルダへ）
icacls "C:\App\Data" /grant "DOMAIN\gMSA-WebApp$:(OI)(CI)RX"
```

---

### 1サービス1gMSAで管理する

1つのgMSAをIIS・SQL Server・タスクスケジューラなど複数用途で使い回すのは避けるべきだ。万が一1つが侵害された場合でも、被害範囲を最小限に抑えられる。

命名規則の例は以下のとおりだ。

- `gMSA-IIS$` — IIS専用
- `gMSA-SqlSvc$` — SQL Server専用
- `gMSA-Scheduler$` — タスクスケジューラ専用

---

### 許可グループのメンバーを定期的に棚卸しする

不要になったサーバーが許可グループに残っていると、そのサーバーからgMSAのパスワードを取得できてしまう。定期的に棚卸しを実施するべきだ。

```powershell
# グループメンバーの確認
Get-ADGroupMember -Identity "gMSA-WebApp-Servers" | Select-Object Name, objectClass

# 不要なサーバーの削除
Remove-ADGroupMember -Identity "gMSA-WebApp-Servers" -Members "OldServer01$"
```

---

### 監査ログで利用状況を監視する

Kerberos認証のイベント（イベントID 4769）をSIEM等で監視することで、不審なgMSA利用を検知できる。また、定期的にLastLogonDateを確認することで、使われていないgMSAを洗い出せる。

```powershell
# gMSA一覧と最終ログオン日時の確認
Get-ADServiceAccount -Filter * -Properties LastLogonDate |
  Select-Object Name, LastLogonDate | Sort-Object LastLogonDate
```

---

### 不要になったgMSAは速やかに無効化・削除する

```powershell
# 無効化
Disable-ADServiceAccount -Identity "gMSA-OldApp"

# 依存サービスがないことを確認してから削除
Remove-ADServiceAccount -Identity "gMSA-OldApp"
```

---

### ADバックアップを確実に取得する

KDSルートキーはADデータベース（NTDS.dit）に含まれているため、**ADのバックアップがそのままKDSルートキーのバックアップ**になる。ADの定期バックアップを怠らないことが重要だ。

---

## まとめ

gMSAを導入することで、サービスアカウントのパスワード管理を完全に自動化し、運用負担とセキュリティリスクを同時に低減できる。設定上のポイントを以下に整理する。

| フェーズ | 実施場所 | 主な注意点 |
|---|---|---|
| KDSルートキー作成 | ADサーバー | **初期構築時1回のみ**。本番では `-EffectiveImmediately` は使わない |
| グループ作成・gMSA作成 | ADサーバー | **gMSA追加のたびに実施**。グループ追加後は対象サーバーの再起動が必要 |
| RSATインストール | 各メンバーサーバー | `Install-WindowsFeature RSAT-AD-PowerShell` |
| Install / Test | 各メンバーサーバー | 各サーバーで個別に実行 |
| IIS適用 | 各メンバーサーバー | フォルダ権限の付与を忘れずに |
| SQL Server適用 | 各メンバーサーバー | 構成マネージャー経由が確実 |

トラブルの大半は「グループへの追加漏れ」「再起動忘れ」「フォルダ権限の不足」の3点に起因する。設定後は必ず `Test-ADServiceAccount` で正常性を確認してほしい。

---

## 参考リンク

- [Group Managed Service Accounts Overview - Microsoft Learn](https://learn.microsoft.com/ja-jp/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview)
- [Getting Started with Group Managed Service Accounts - Microsoft Learn](https://learn.microsoft.com/ja-jp/windows-server/security/group-managed-service-accounts/getting-started-with-group-managed-service-accounts)
