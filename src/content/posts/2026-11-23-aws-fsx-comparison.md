---
title: "Amazon FSx 4種の違いと目的別の選び方 — Windows / ONTAP / OpenZFS / Lustre を整理する"
description: "Amazon FSx の4種類（Windows File Server・NetApp ONTAP・OpenZFS・Lustre）の違いをプロトコル・性能・可用性・機能で比較し、目的別の選択基準をフローとして整理する。"
pubDate: 2026-11-23
tags: ["AWS", "Amazon FSx", "ファイルサーバ", "ストレージ", "設計"]
category: "AWS"
draft: false
featured: false
---

---

## はじめに

AWS でファイルサーバを用意しようとすると、Amazon FSx だけで4種類の選択肢がある。名前は似ているが、中身はまったく別物のファイルシステムである。本記事では4種の違いを表で整理し、「何をしたいか」から1つに絞り込むための選択基準をまとめる。

> **確認日**: 本記事の仕様・数値は **2026年11月23日** 時点の AWS 公式情報（比較ページ・ユーザーガイド・料金ページ・What's New）で確認した。FSx は機能追加が頻繁なため、設計時は最新の公式ドキュメントを参照してほしい。

---

## 目次

- [4種の全体像](#4種の全体像)
- [スペック比較表](#スペック比較表)
- [機能比較表](#機能比較表)
- [各サービスの特徴](#各サービスの特徴)
- [目的別の選択基準](#目的別の選択基準)
- [よくある迷いどころ](#よくある迷いどころ)
- [メリットとデメリット](#メリットとデメリット)
- [選定時の自身の観点](#選定時の自身の観点)
- [まとめ](#まとめ)
- [参考リンク](#参考リンク)

---

## 4種の全体像

Amazon FSx は、既存の有名なファイルシステムを AWS がフルマネージドで提供するサービス群である。ひとことで表すと以下のとおりだ。

| サービス | ひとことで言うと | 主なプロトコル | 主なクライアント |
|---|---|---|---|
| FSx for Windows File Server | クラウド版の Windows ファイルサーバ | SMB | Windows 中心 |
| FSx for NetApp ONTAP | クラウド版の NetApp NAS（なんでも屋） | NFS / SMB / iSCSI / NVMe | Windows・Linux・macOS |
| FSx for OpenZFS | 低レイテンシな Linux 向け NFS サーバ | NFS | Linux 中心 |
| FSx for Lustre | HPC・機械学習向けの並列ファイルシステム | Lustre（独自 POSIX 互換） | Linux のみ |

AWS 公式も「現在オンプレで使っている技術に近いものを選ぶ」ことを最初の判断軸として挙げている。

| 現在のストレージ | 推奨される FSx |
|---|---|
| Windows Server のファイルサーバ | FSx for Windows File Server |
| NetApp ONTAP などの NAS アプライアンス | FSx for NetApp ONTAP |
| ZFS などの Linux ベースのファイルサーバ | FSx for OpenZFS |
| Lustre などの並列ファイルシステム | FSx for Lustre |

---

## スペック比較表

AWS 公式の比較ページ（2026年11月23日確認）の値を整理した。スループットの幅は、下限がベースライン、上限がキャッシュ・バースト・圧縮効果込みの値である。

| 項目 | Windows | ONTAP | OpenZFS | Lustre |
|---|---|---|---|---|
| レイテンシ | 1ms 未満 | 1ms 未満 | **0.5ms 未満** | 1ms 未満 |
| 最大スループット/FS | 12〜20 GB/s | 72〜80 GB/s ※ | 10〜21 GB/s | **1,000 GB/s** |
| 最大スループット/クライアント | 20 GB/s | 18 GB/s | 10 GB/s | **150 GB/s** |
| 最大 IOPS/FS | 数十万 | 数百万 | 100〜200万 | 数百万 |
| 最大容量/FS | 64 TiB | 実質無制限（数十 PB） | 512 TiB | 数 PB |
| デプロイ形態 | Single-AZ / Multi-AZ | Single-AZ / Multi-AZ | Single-AZ / Multi-AZ | Single-AZ のみ（Persistent / Scratch） |
| SLA | Multi-AZ 99.99% / Single-AZ 99.5% | Multi-AZ 99.99% / Single-AZ 99.9% | Multi-AZ 99.99% / Single-AZ 99.5% | 99.5% |

※ 比較ページの値は第2世代までの数値である。2026年11月に第3世代（Single-AZ 3 / Multi-AZ 3）が追加され、ONTAP ユーザーガイドでは Single-AZ 3 の最大読み取りスループットが約 221 GB/s（12 HA ペア構成）とされている。世代ごとに対応リージョンが異なるため、利用するリージョンで選べるかを公式ドキュメントで確認してほしい。

> **ポイント**: 性能だけ見ると Lustre が突出しているが、Linux 専用かつ Single-AZ のみである。「一般的な業務ファイル共有」には向かない点を押さえておきたい。

---

## 機能比較表

機能面の差は以下のとおりだ（○＝対応、－＝非対応または公式比較表に記載なし）。

| 機能 | Windows | ONTAP | OpenZFS | Lustre |
|---|---|---|---|---|
| Active Directory 認証 | ○ | ○ | － | － |
| NTFS ACL | ○ | ○ | － | － |
| ファイルアクセス監査 | ○ | ○ | － | － |
| ウイルス対策連携 | － | ○ | － | － |
| スナップショット | ○ | ○ | ○ | － |
| エンドユーザーによるファイル復元 | ○ | ○ | ○ | － |
| 瞬時クローン | － | ○ | ○ | － |
| 重複排除 | ○ | ○ | － | － |
| 圧縮・クォータ | ○ | ○ | ○ | ○ |
| 低コスト階層 | HDD | キャパシティプール（自動階層化） | Intelligent-Tiering | HDD / Intelligent-Tiering |
| リージョン間レプリケーション | － | ○（SnapMirror） | ○（オンデマンド） | S3 のクロスリージョン複製経由 |
| S3 連携 | － | S3 Access Points | S3 Access Points | S3 自動インポート/エクスポート |
| オンプレとのハイブリッド | － | ○（SnapMirror / FlexCache） | － | － |

> **注意**: 機能は頻繁に追加される。OpenZFS の S3 Access Points（2025年6月）、ONTAP の S3 Access Points（2025年12月）、ONTAP のリージョン・アカウント間バックアップコピー（2026年8月）など、ここ1〜2年でも差は縮まりつつある。設計時は必ず最新のドキュメントを確認してほしい。

---

## 各サービスの特徴

---

### FSx for Windows File Server

Windows Server 上に構築された、SMB ファイル共有のためのサービスである。主な特徴は以下のとおりだ。

- Active Directory（AWS Managed Microsoft AD または自己管理 AD）への参加が前提
- NTFS ACL、DFS 名前空間、シャドウコピー（以前のバージョン）がそのまま使える
- 重複排除・ユーザークォータに対応
- SSD は 32 GiB から、HDD は 2,000 GiB から構成できる（2,000 GiB 未満なら SSD 一択）
- 最大容量は 64 TiB と4種の中で最小

オンプレの Windows ファイルサーバをそのまま持っていく「リフト＆シフト」の第一候補である。運用担当者の学習コストがほぼゼロという点が最大の強みだ。

> **注意**: 実効性能は「ストレージタイプ×容量」と「スループットキャパシティ」のうち低い方で決まる。小さな HDD にスループットキャパシティだけ高く設定しても性能は出ず、費用だけがかさむ。また、ストレージ容量は拡張のみで縮小できないため、初期サイズは控えめに決めるのが無難である。

---

### FSx for NetApp ONTAP

NetApp の ONTAP を AWS 上で動かすサービスで、4種の中で最も機能が多い。主な特徴は以下のとおりだ。

- NFS・SMB・iSCSI・NVMe を1つのファイルシステムで同時提供（マルチプロトコル）
- SVM（ストレージ仮想マシン）単位で Active Directory に参加でき、NTFS ACL・ファイルアクセス監査にも対応
- SSD 層と低コストのキャパシティプール層の間でコールドデータを自動階層化
- SnapMirror によるオンプレ NetApp とのレプリケーション、FlexCache によるキャッシュ
- 重複排除・圧縮・コンパクションでストレージ効率が高い
- 容量は実質無制限（数十 PB）

Windows と Linux から同じデータに触りたい、オンプレの NetApp と連携したい、ブロックストレージ（iSCSI）も欲しい、といった要件が1つでもあれば有力候補になる。

> **注意**: コストの大半を占めるのは SSD 層である。第1世代は SSD 容量を縮小できない（第2・第3世代は HA ペアあたり 1,024 GiB まで縮小可能）。最小構成で始め、自動階層化でコールドデータを逃がしながら拡張するのが定石だ。

---

### FSx for OpenZFS

OpenZFS 上に構築された NFS ファイルサーバである。主な特徴は以下のとおりだ。

- 0.5ms 未満と4種の中で最も低レイテンシ
- 瞬時スナップショット・クローンで開発/テスト環境の複製が速い
- Intelligent-Tiering ストレージクラスで容量コストを抑えられる
- S3 Access Points を付けると、データを移動せずに S3 API から読み書きできる
- SSD 容量は拡張のみで縮小できない

Linux 系のワークロード（Web コンテンツ、CI/CD、データ分析、メディア処理）で、AD 連携や SMB が不要な場合にシンプルで速い選択肢となる。

---

### FSx for Lustre

スパコンでも使われる並列ファイルシステム Lustre のマネージド版である。主な特徴は以下のとおりだ。

- 最大 1,000 GB/s、1クライアントあたり 150 GB/s という桁違いのスループット
- S3 バケットと関連付けて、データの自動インポート/エクスポートが可能
- 短期処理向けの Scratch と、データを保持する Persistent の2種類
- Lustre クライアントが必要なため Linux 専用

機械学習の学習データ、HPC、ゲノム解析、レンダリングなど「大量データを多数のノードで一気に読む」用途専用と考えてよい。

---

## 目的別の選択基準

上から順に判定すれば、ほとんどのケースで1つに絞り込める。

```text
Q1. 数百GB/s 級のスループットで、多数の Linux ノードから並列処理する？
    （ML 学習 / HPC / ゲノム解析 / レンダリング）
    └─ Yes → FSx for Lustre

Q2. 次のいずれかが必要？
    ・Windows と Linux から同じデータに同時アクセス（SMB + NFS）
    ・iSCSI（ブロックストレージ）
    ・オンプレ NetApp との SnapMirror / FlexCache 連携
    ・64 TiB を超える SMB 共有、または数十 PB 規模
    └─ Yes → FSx for NetApp ONTAP

Q3. クライアントが Windows 中心の SMB 共有で、Windows Server の運用で完結させたい？
    └─ Yes → FSx for Windows File Server
              （AD 連携・NTFS ACL は ONTAP でも可能。迷ったら後述の比較表へ）

Q4. クライアントが Linux 中心で NFS を使う？
    └─ Yes → FSx for OpenZFS
              （ペタバイト級やマルチプロトコルが将来見込まれるなら ONTAP も比較）
```

用途ごとの推奨をまとめると以下のとおりだ。

| 目的・ユースケース | 第一候補 | 次点 |
|---|---|---|
| 部署の共有フォルダ・ホームディレクトリ（Windows） | Windows | ONTAP |
| オンプレ Windows ファイルサーバの移行 | Windows | ONTAP |
| オンプレ NetApp の移行・DR | ONTAP | － |
| Windows と Linux の混在環境でのデータ共有 | ONTAP | － |
| SQL Server の共有ストレージ（FCI） | Windows（SMB） | ONTAP（iSCSI / SMB） |
| VMware Cloud on AWS のデータストア | ONTAP | － |
| Linux の Web コンテンツ・CI/CD・開発環境の複製 | OpenZFS | ONTAP |
| オンプレ ZFS / Linux NFS サーバの移行 | OpenZFS | ONTAP |
| 機械学習の学習データ・HPC | Lustre | － |
| S3 のデータを高速にファイルとして処理 | Lustre | － |
| ファイルデータを S3 API で Bedrock / Athena に渡したい | ONTAP / OpenZFS（S3 Access Points） | － |

> **ポイント**: 迷ったら「クライアントの OS」と「必要なプロトコル」から決めると外さない。性能や価格は、その後で同じプロトコルを持つ候補同士を比べればよい。

---

## よくある迷いどころ

---

### Windows と ONTAP のどちらにするか

どちらも SMB と AD 連携に対応するため、Windows ファイル共有では毎回ここで迷う。「移行元が Windows だから Windows」と決め打ちせず、容量・コスト・機能で比べるのがよい。DevelopersIO の記事（参考リンク参照）の判断ポイントを、AWS 公式情報と照合したうえで表に整理すると以下のとおりだ。

| 観点 | Windows が有利 | ONTAP が有利 |
|---|---|---|
| 容量 | SSD で 1 TiB 未満の小規模（Windows は 32 GiB から、ONTAP は 1,024 GiB から） | 数十 TiB 以上、または 64 TiB 超 |
| コスト構造 | ほぼ全データが同じ頻度で使われる | アクセスの少ないデータが多い（自動階層化で SSD を節約） |
| スループット単価 | － | 高スループットが必要（ONTAP の方が単価が安い） |
| 可用性 | － | Single-AZ でも2ノード構成でメンテナンス停止の影響が小さい |
| データ保護 | － | SnapRestore での一括巻き戻し、SnapMirror による短い RPO、SnapLock（WORM） |
| 機能 | 監査ログを CloudWatch Logs / Data Firehose へ直接出したい | NFS 併用、Vscan、QoS、ディレクトリ単位クォータ |
| 運用 | Windows の知識と PowerShell で完結させたい | ONTAP の運用経験がある |

ONTAP は SVM・ボリューム・階層化ポリシーなど NetApp 固有の概念を覚える必要がある。機能表で ONTAP が勝っても、運用体制に対してオーバースペックでないかは最後に確認すべきである。

---

### OpenZFS と EFS のどちらにするか

Linux 向け NFS なら FSx ではない Amazon EFS も候補になる。違いの目安は以下のとおりだ。

- **EFS を選ぶ**: 容量を事前に決めたくない、サーバーレス（Lambda など）から使いたい、多数の AZ から気軽にマウントしたい
- **OpenZFS を選ぶ**: 低レイテンシ・高 IOPS が必要、スナップショット/クローンを多用したい、オンプレの ZFS から移行したい

---

### Lustre を汎用ファイルサーバに使えないか

使えなくはないが勧めない。Linux 専用で AD 連携や SMB がなく、Single-AZ のみのため可用性要件も満たしにくい。Lustre は「計算処理の間だけ高速に読むための作業領域」と割り切るのが正しい使い方である。

---

## メリットとデメリット

4種それぞれの長所と短所を並べると以下のとおりだ。

| サービス | メリット | デメリット |
|---|---|---|
| Windows | Windows 管理者がそのまま運用できる／AD・ACL・DFS 互換 | SMB のみ／最大 64 TiB／AD が必須 |
| ONTAP | マルチプロトコル／自動階層化／SnapMirror でハイブリッド・DR に強い | 機能が多く NetApp の知識が必要／小規模だと割高になりやすい |
| OpenZFS | 最も低レイテンシ／スナップショット・クローンが高速／構成がシンプル | NFS のみ／AD 連携なし |
| Lustre | 桁違いのスループット／S3 との自動連携 | Linux 専用／Single-AZ のみ／汎用共有には不向き |

---

## 選定時の自身の観点

インフラ運用の立場から見ると、性能よりも先に次の3点を確認するようにしている。

- **誰が運用するか**: Windows チームなら Windows、ストレージ専任や NetApp 経験者がいるなら ONTAP が無理なく回る
- **データが今後どう増えるか**: 64 TiB や 512 TiB の上限に将来ぶつかりそうなら、最初から ONTAP を検討しておく方が移行の手戻りがない
- **可用性要件**: 本番の業務共有なら Multi-AZ が組めるかが前提条件になる。この時点で Lustre は候補から外れる

「とりあえず一番速いもの」「とりあえず一番機能が多いもの」で選ぶと、運用負荷やコストで後悔しやすい。要件を満たす最小構成を選ぶことが、結果的に一番安定する。

---

## まとめ

選択の流れを改めて整理すると以下のとおりだ。

```text
大規模並列処理（ML / HPC）          → FSx for Lustre
マルチプロトコル・ハイブリッド・大容量 → FSx for NetApp ONTAP
Windows 中心の SMB 共有             → FSx for Windows File Server
Linux 向け NFS（低レイテンシ）        → FSx for OpenZFS
```

4種は「性能の松竹梅」ではなく、それぞれ別の用途向けの道具である。まずクライアント OS とプロトコルで絞り、その上で容量・可用性・運用体制で最終判断するのが失敗しない選び方だ。

---

## 参考リンク

- [Choosing an Amazon FSx File System（AWS 公式）](https://aws.amazon.com/fsx/when-to-choose-fsx/)
- [Amazon FSx ドキュメント](https://docs.aws.amazon.com/fsx/)
- [FSx for Windows File Server performance（AWS ドキュメント）](https://docs.aws.amazon.com/fsx/latest/WindowsGuide/performance.html)
- [Amazon FSx for NetApp ONTAP performance（AWS ドキュメント）](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/performance.html)
- [File system storage capacity and IOPS - FSx for ONTAP（AWS ドキュメント）](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/storage-capacity-and-IOPS.html)
- [Amazon FSx for Windows File Server 料金](https://aws.amazon.com/fsx/windows/pricing/)
- [Amazon FSx for NetApp ONTAP 料金](https://aws.amazon.com/fsx/netapp-ontap/pricing/)
- [Amazon FSx for NetApp ONTAP と FSx for Windows File Server の判断ポイント（DevelopersIO）](https://dev.classmethod.jp/articles/amazon-fsx-ontap-windows-file-server-decision-points/)
- [FSx for NetApp ONTAP はなぜ「安くて速い」のか（サーバーワークスエンジニアブログ）](https://blog.serverworks.co.jp/fsx-ontap-tiering-explanation)
- [Amazon FSx for Windows File Server のパフォーマンス設計について（サーバーワークスエンジニアブログ）](https://blog.serverworks.co.jp/fsx-performance-design)
- [オンプレミスからデータ移行する時の考慮事項（サーバーワークスエンジニアブログ）](https://blog.serverworks.co.jp/fsx-on-premises-data-migration)
- [Amazon FSx for OpenZFS now supports Amazon S3 access（AWS News Blog）](https://aws.amazon.com/blogs/aws/amazon-fsx-for-openzfs-now-supports-amazon-s3-access-without-any-data-movement)
- [Amazon FSx for NetApp ONTAP now supports S3 access（What's New）](https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-fsx-netapp-ontap-s3-access/)
- [Amazon FSx for NetApp ONTAP now supports copying backups across AWS Regions and accounts（What's New）](https://aws.amazon.com/about-aws/whats-new/2026/08/fsx-ontap-cross-region-backup-copy/)
- [Amazon FSx for OpenZFS now supports on-demand data replication across AWS opt-in Regions（What's New）](https://aws.amazon.com/about-aws/whats-new/2026/06/on-demand-cross-region-replication/)
