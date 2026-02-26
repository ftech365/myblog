---
title: "Hyper-V上のWindows 11 VMにClaude Codeローカル環境を構築する手順"
description: "Hyper-V上のWindows 11の開発環境VMを作成し、Ubuntuを有効化してClaude Codeをインストールするまでの手順を解説する。"
pubDate: 2026-02-25
tags: ["Claude Code", "Hyper-V", "Ubuntu", "Windows11", "環境構築"]
category: "その他"
draft: false
---

## はじめに

本記事では Hyper-V 上に Windows 11 の開発環境 VM を構築し、その VM 内で Ubuntu を有効化、最終的に Claude Code をインストールするまでの手順を記録する。なお、Claude Code の利用には有料プランの契約が必要だ。

---

## 目次

- [構成概要](#構成概要)
- [前提条件](#前提条件)
- [手順1: Windows 11 開発環境 VM の作成](#手順1-windows-11-開発環境-vm-の作成)
- [手順2: OS 設定](#手順2-os-設定)
- [手順3: VM 内で Hyper-V 関連機能を有効化](#手順3-vm-内で-hyper-v-関連機能を有効化)
- [手順4: ホストマシンでネスト仮想化を有効化](#手順4-ホストマシンでネスト仮想化を有効化)
- [手順5: VM 内で Ubuntu を有効化](#手順5-vm-内で-ubuntu-を有効化)
- [手順6: Ubuntu のアップデート](#手順6-ubuntu-のアップデート)
- [手順7: Claude Code のインストール](#手順7-claude-code-のインストール)
- [手順8: バージョン確認](#手順8-バージョン確認)
- [動作確認](#動作確認)
- [まとめ](#まとめ)

---

## 構成概要

本手順で構築する環境の全体像は以下のとおりだ。

```
物理ホストマシン（Windows）
└── Hyper-V
    └── Windows 11 開発環境 VM
            └── Ubuntu
                └── Claude Code CLI
```

ポイントは **VM の中で Ubuntu を動かす** という点だ。これを実現するには Hyper-V のネスト仮想化（仮想化拡張機能の公開）が必要になる。手順4がその設定にあたる。

また Hyper-V 上に構築することで Windows 開発環境の建て直しが容易になるが、ライセンスの問題で定期的な再構築が必要となる点は留意しておきたい。

---

## 前提条件

作業を始める前に、以下の条件をすべて満たしていることを確認する。

- 物理ホストマシンが Hyper-V に対応していること（Intel VT-x / AMD-V が有効）
- ホスト OS が Windows 11 Pro であること（Hyper-V が利用できるエディションであること）
- 管理者権限のあるアカウント
- インターネット接続

---

## 手順1: Windows 11 開発環境 VM の作成

Hyper-V マネージャーを使って Windows 11 の仮想マシンを作成する。

---

### Hyper-V マネージャーの起動

スタートメニューで「Hyper-V マネージャー」と検索して起動する。

---

### VM のクイック作成

Hyper-V Manager 右ペインにある「クイック作成」をクリックすることで Windows 11 開発環境を導入できる。特に設定変更は不要だ。

---

## 手順2: OS 設定

Windows 11 のインストールが完了したら、VM 内の OS セキュリティ設定を済ませておく。

最低限実施しておきたい設定は以下の通りだ。

- Windows Update を最新の状態にする
- Windows Defender / ウイルス対策が有効になっていることを確認
- 不要なリモートデスクトップ・共有設定の無効化
- アカウントの新規作成 + User アカウントの無効化
- 日本語環境設定（言語・時刻）

> **ポイント**: 開発環境であっても基本的なセキュリティは最初に済ませておくのが鉄則だ。デフォルトでは初期アカウントがパスワードなしでログイン可能になっているため、新規管理者アカウントを作成して初期アカウントは無効化すること。

---

## 手順3: VM 内で Hyper-V 関連機能を有効化

VM 内の Windows 11 で **管理者権限のコマンドプロンプト** を開き、以下を順番に実行する。

> **注意**: この手順は VM の**中**で実行する。ホストマシンではない。

---

### Virtual Machine Platform の有効化

仮想マシンプラットフォーム機能を有効化する。`/norestart` を付けているため、この時点では再起動されない。

```cmd
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

---

### Hyper-V 全機能の有効化

Hyper-V に関連するすべての機能を有効化する。実行後に再起動を促されるので、再起動を行う。

```cmd
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all
```

> **注意**: 管理者権限で実行しないとエラーになる。コマンドプロンプトを右クリック →「管理者として実行」で起動すること。

---

## 手順4: ホストマシンでネスト仮想化を有効化

VM 内で Ubuntu を動かすには、**ホストマシン側**でネスト仮想化を有効にする必要がある。**VM をシャットダウンした状態**で、ホストマシンの PowerShell を管理者権限で開き以下を実行する。

```powershell
Set-VMProcessor -VMName "Windows 11 開発環境" -ExposeVirtualizationExtensions $true
```

各コマンドの意味は以下のとおりだ。

| コマンド部分 | 意味 |
|---|---|
| `Set-VMProcessor` | VM のプロセッサ設定を変更するコマンド |
| `-VMName "Windows 11 開発環境"` | 対象の VM 名を指定（作成時の名前と一致させること） |
| `-ExposeVirtualizationExtensions $true` | CPU の仮想化拡張機能を VM 内に公開する |

> **ポイント**: `-VMName` の値は Hyper-V マネージャーに表示されている VM 名と完全に一致させること。スペースも含めて正確に入力する。また必ず VM をシャットダウンしてから実行すること。

設定後、VM を再起動する。

---

## 手順5: VM 内で Ubuntu を有効化

VM を起動して Windows 11 にログインし、タスクバーの検索ウィンドウから Ubuntu を実行する。手順は以下のとおりだ。

- Microsoft Store ウィンドウが開き、Ubuntu 製品の画面が表示される。「入手」をクリックする
- インストール完了を待つ。完了すると「入手」が「開く」に変更になるためクリックする

以上で Ubuntu の導入は完了となる。

---

## 手順6: Ubuntu のアップデート

Ubuntu を開いた状態から開始する。初回起動時は Ubuntu の初期設定（ユーザー名・パスワードの設定）が求められる。

```
Enter new UNIX username: （任意のユーザー名を入力）
New password: （パスワードを入力）
Retype new password: （パスワードを再入力）
```

初期設定が完了したら、Ubuntu のターミナルで以下を実行しパッケージを最新の状態にする。

```bash
sudo apt update && sudo apt upgrade -y
```

各コマンドの意味は以下のとおりだ。

| コマンド部分 | 意味 |
|---|---|
| `sudo` | 管理者権限で実行する |
| `apt update` | パッケージリストを最新の状態に更新する |
| `apt upgrade -y` | インストール済みパッケージを一括アップグレードする |
| `-y` | 確認プロンプトをすべて「yes」で自動回答する |

---

## 手順7: Claude Code のインストール

Ubuntu のターミナルで以下を順番に実行する。

---

### インストールスクリプトの実行

以下のコマンドでインストールスクリプトをダウンロードし、そのまま実行する。

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

各オプションの意味は以下のとおりだ。

| オプション | 意味 |
|---|---|
| `curl` | URL からファイルをダウンロードするコマンド |
| `-fsSL` | エラー時に失敗・進行状況を非表示・リダイレクトに追従 |
| `\| bash` | ダウンロードしたスクリプトをそのまま実行する |

---

### PATH の設定

インストール後、以下の PATH 設定を行う。この設定をしないと `claude` コマンドが見つからないエラーになるため、必ず実行すること。

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

| コマンド部分 | 意味 |
|---|---|
| `echo '...' >> ~/.bashrc` | パスの設定を `.bashrc` ファイルに追記する |
| `source ~/.bashrc` | `.bashrc` を再読み込みして設定を即時反映する |

---

## 手順8: バージョン確認

インストールが正常に完了しているか確認する。以下のコマンドを実行してバージョン番号が表示されれば成功だ。

```bash
claude --version
```

```bash
# 出力例
2.x.x (Claude Code)
```

インストール状態の詳細確認は `claude doctor` で行える。

```bash
claude doctor
```

```bash
# 出力例
Diagnostics
  Currently running; native(2.x.xx)
  Path: /home/(ユーザ名)/.local/share/claude...
  Invoked: /home/(ユーザ名)/.local/share/claude...
  …
Updates
  Auto-update: enabled
  Auto-update channel: latest
```

---

## 動作確認

Ubuntu コンソール上にて、プロジェクトディレクトリを作成し Claude Code を起動してみる。

```bash
mkdir ~/test-project && cd ~/test-project
claude
```

対話型のプロンプトが起動すれば環境構築は完了だ。初回起動時は Anthropic アカウントの認証が求められるため、事前にアカウントを作成しておくこと。

---

## まとめ

全体の手順を振り返ると以下のとおりだ。

```
① Hyper-V で Windows 11 開発環境 VM を作成
      ↓
② VM 内で OS セキュリティ設定
      ↓
③ VM 内で Hyper-V 関連機能を有効化（dism コマンド）※ VM 内で実行
      ↓
④ ホストマシンでネスト仮想化を有効化（PowerShell）※ ホストで実行・VM 停止中
      ↓
⑤ VM 内で Ubuntu を有効化
      ↓
⑥ Ubuntu のアップデート
      ↓
⑦ Claude Code のインストール・PATH 設定
      ↓
⑧ バージョン確認・動作確認
```

**最大のポイントは手順③と④の実行場所の違い**だ。③は VM の中、④はホストマシン側での実行になる。ここを混同すると設定が反映されないため注意してほしい。

---

## 参考リンク

- [Claude Code 公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Microsoft: WSL のインストール](https://learn.microsoft.com/ja-jp/windows/wsl/install)
- [Microsoft: Hyper-V on Windows 11](https://learn.microsoft.com/ja-jp/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v)
