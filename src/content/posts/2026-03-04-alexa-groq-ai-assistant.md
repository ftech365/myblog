---
title: "AlexaをAIアシスタント化する — Groq × AWS Lambdaで日本語音声AIを作る"
description: "Groq APIとAWS Lambdaを組み合わせてAlexaをAIアシスタント化する手順。Qwen3モデルを使った日本語対応、トラブルシューティングも含めて解説する。"
pubDate: 2026-03-04
tags: ["Alexa", "Groq", "AWS Lambda", "Python", "AI"]
category: "その他"
draft: false
featured: false
---

## はじめに

自宅にAlexaデバイスがあるなら、それをAIアシスタントにできる。  
AmazonのBedrock等を使う方法もあるが、今回は無料枠が豊富な**Groq API**と**AWS Lambda**を組み合わせて、日本語で何でも答えてくれるAlexaスキルを作る。

---

## 目次

- [構成概要](#構成概要)
- [前提条件](#前提条件)
- [手順1: Groq APIキーの取得](#手順1-groq-apiキーの取得)
- [手順2: AWS Lambda関数の作成](#手順2-aws-lambda関数の作成)
- [手順3: Alexaスキルの作成・設定](#手順3-alexaスキルの作成設定)
- [手順4: LambdaとAlexaの連携](#手順4-lambdaとalexaの連携)
- [手順5: 動作確認](#手順5-動作確認)
- [トラブルシューティング](#トラブルシューティング)
- [まとめ](#まとめ)

---

## 構成概要

全体の構成は以下のとおりだ。

| コンポーネント | 役割 |
|---|---|
| Alexaデバイス | 音声入力・出力 |
| Alexa Skills Kit | 音声をテキスト化してLambdaに送信 |
| AWS Lambda | リクエストを受け取りGroq APIを呼び出す |
| Groq API (Qwen3-32B) | AIによる回答生成 |

音声の流れは次のとおりだ。

```
ユーザー発話 → Alexa → Lambda → Groq API → Lambda → Alexa → 音声出力
```

---

## 前提条件

以下が必要だ。

- AWSアカウント（Lambda使用可能）
- Amazon Developerアカウント（Alexaスキル開発用）
- Groqアカウント（無料登録可）
- 物理AlexaデバイスまたはAlexaアプリ（同一Amazonアカウントで紐付け）

---

## 手順1: Groq APIキーの取得

---

### Groqとは

Groqはアメリカ・カリフォルニア州のAI推論サービスだ。独自のLPU（Language Processing Unit）チップにより、一般的なGPUサービスより大幅に高速な推論が可能で、**レスポンスが250ms以下**になることも多い。Alexaのような音声UIではレイテンシが体験に直結するため、Groqの速度優位性は大きい。

無料枠は1日1,000リクエスト以上あり、個人利用には十分だ。

---

### APIキーの取得手順

以下の手順でAPIキーを取得する。

1. [console.groq.com](https://console.groq.com) にアクセスしてアカウント登録
2. ダッシュボード左メニューの「API Keys」をクリック
3. 「Create API Key」でキーを生成
4. 生成されたキーをコピーして安全な場所に保存

> **注意**: APIキーは一度しか表示されない。必ず控えておくこと。

---

### 使用モデルについて

今回は `qwen/qwen3-32b` を使用する。Qwen3はAlibaba製のオープンソースモデルで、日本語性能が高い。Groq経由で使用する場合、モデルの重みはGroqのアメリカ国内サーバーにインストールされているため、**データがAlibaba（中国）のサーバーに送信されることはない**。

---

## 手順2: AWS Lambda関数の作成

---

### 関数の作成

以下の手順でLambda関数を作成する。

1. AWSコンソール → Lambda → 「関数の作成」
2. 「一から作成」を選択
3. 以下の設定で作成する

| 項目 | 設定値 |
|---|---|
| 関数名 | `alexa-groq-assistant`（任意） |
| ランタイム | Python 3.12 |
| アーキテクチャ | x86_64 |

---

### タイムアウトの変更

デフォルトのタイムアウトは3秒だが、Groq APIの呼び出しに時間がかかる場合があるため**30秒に変更**する。

「設定」タブ → 「一般設定」→「編集」→ タイムアウトを `0分30秒` に設定。

---

### Lambdaコードの実装

以下のコードをLambdaのコードエディタに貼り付ける。

```python
import json
import urllib.request

GROQ_API_KEY = "ここにAPIキーを貼り付ける"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

def lambda_handler(event, context):
    request_type = event["request"]["type"]
    
    if request_type == "LaunchRequest":
        return build_response("AIアシスタントです。何でも聞いてください！")
    
    elif request_type == "IntentRequest":
        intent = event["request"]["intent"]["name"]
        
        if intent == "AskAIIntent":
            user_input = event["request"]["intent"]["slots"]["query"]["value"]
            answer = ask_groq(user_input)
            return build_response(answer)
    
    return build_response("うまく聞き取れませんでした。もう一度お願いします。")

def ask_groq(text):
    body = json.dumps({
        "model": "qwen/qwen3-32b",
        "messages": [
            {
                "role": "system",
                "content": "あなたは音声アシスタントです。回答は必ず日本語で、3文以内の短い文章で答えてください。"
            },
            {"role": "user", "content": text}
        ],
        "max_tokens": 500
    }).encode("utf-8")
    
    req = urllib.request.Request(
        GROQ_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "User-Agent": "Mozilla/5.0"
        }
    )
    try:
        with urllib.request.urlopen(req) as res:
            result = json.loads(res.read())
            text = result["choices"][0]["message"]["content"]
            # <think>タグを除去
            if "</think>" in text:
                text = text.split("</think>")[-1].strip()
            return text
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        return f"HTTPエラー {e.code}：{error_body}"
    except Exception as e:
        return f"エラーが発生しました：{str(e)}"

def build_response(text):
    return {
        "version": "1.0",
        "response": {
            "outputSpeech": {"type": "PlainText", "text": text},
            "shouldEndSession": False
        }
    }
```

> **ポイント**: `User-Agent` ヘッダーを付けないとGroqから403エラーが返ることがある。必ず含めること。

コードを貼り付けたら「Deploy」ボタンをクリックして保存する。

---

### LambdaのARNをコピー

画面右上に表示されている **関数ARN**（`arn:aws:lambda:ap-northeast-1:...` の形式）をコピーしておく。次の手順で使用する。

---

## 手順3: Alexaスキルの作成・設定

---

### スキルの作成

1. [developer.amazon.com](https://developer.amazon.com) にアクセス
2. 「Alexa Skills Kit」→「スキルの作成」
3. 以下の設定で作成する

| 項目 | 設定値 |
|---|---|
| スキル名 | `さくら`（呼び出し名と揃える） |
| 言語 | 日本語（日本） |
| モデル | カスタム |
| ホスティング | ユーザー定義のプロビジョニング |

---

### 呼び出し名の設定(Invocations > Skill Invocation Name)

呼び出し名はAlexaが音声で認識するトリガーワードだ。設定には以下の点に注意する。

- **ひらがな2〜4音節**が最も認識されやすい
- 「AI」「アシスタント」などのカタカナ・英語系は誤認識されやすい
- 動画・音楽系を連想させる言葉は別のスキルと混同される
- スキル名と呼び出し名は**同じ名前に揃える**

「呼び出し名」欄に `さくら`（または任意のひらがな名）を入力する。

---

### インテントとスロットの設定

「インテント」→「インテントの追加」で `AskAIIntent` を作成する。

スロットを以下の設定で追加する。

| 項目 | 設定値 |
|---|---|
| スロット名 | `query` |
| スロットタイプ | `AMAZON.SearchQuery` |

サンプル発話を追加する。スロットのみの発話はエラーになるため、**必ず先頭に言葉を付ける**。

```
教えて {query}
調べて {query}
質問 {query}
```

> **注意**: `{query}` だけの発話はエラーになる。必ずキャリアフレーズ（先頭の言葉）を含めること。

設定が完了したら「モデルを保存してビルド」をクリックする。

---

## 手順4: LambdaとAlexaの連携

この手順が最も重要だ。**LambdaとAlexaはお互いのIDを登録しあうことで初めて連携できる**。順序を間違えないように注意してほしい。

```
① AlexaコンソールでスキルIDを確認
        ↓
② LambdaにスキルIDを登録（トリガー追加）
        ↓
③ LambdaのARNを確認
        ↓
④ AlexaコンソールにARNを登録（エンドポイント設定）
```

---

### ① AlexaコンソールでスキルIDを確認

1. Alexaコンソール → 作成したスキルを開く
2. 左メニュー「エンドポイント」をクリック
3. 画面上部に表示される **スキルID**（`amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` の形式）をコピーする

> **ポイント**: このスキルIDをLambdaに登録することで、そのAlexaスキルからのリクエストのみを受け付けるようになる。

---

### ② LambdaにスキルIDを登録（トリガー追加）

1. AWSコンソール → 作成したLambda関数を開く
2. 「トリガーを追加」をクリック
3. 「Alexa Skills Kit」を選択
4. 「スキルID検証」を**有効**のまま、①でコピーしたスキルIDを貼り付ける
5. 「追加」をクリック

---

### ③ LambdaのARNを確認

トリガー追加後、Lambda関数画面の**右上**に表示されている **関数ARN**（`arn:aws:lambda:ap-northeast-1:123456789:function:alexa-groq-assistant` の形式）をコピーする。

> **ポイント**: このARNをAlexaコンソールに登録することで、AlexaがどのLambda関数を呼び出すかを知ることができる。

---

### ④ AlexaコンソールにARNを登録（エンドポイント設定）

1. Alexaコンソール → 左メニュー「エンドポイント」
2. 「AWS Lambda ARN」を選択
3. 「デフォルトの地域」に③でコピーしたARNを貼り付ける
4. 「エンドポイントを保存」→「モデルを保存してビルド」をクリック

ビルドが完了すれば連携は完了だ。

---

## 手順5: 動作確認

---

### Alexaコンソールのテストタブで確認

まずコンソール上でテキスト入力により動作確認する。

1. Alexaコンソール上部の「テスト」タブをクリック
2. 「このスキルでは、テストは有効です」のトグルを**オン**にする
3. テキスト入力欄に以下を入力して送信する

```
さくらを開いて
```

「AIアシスタントです。何でも聞いてください！」と返ってくれば起動は成功だ。続けて質問を試す。

```
教えて 東京の名物料理
```

Groq APIが日本語で回答を返してくれば連携は完璧だ。

---

### 物理Alexaデバイスで確認

物理デバイスで動かすには以下の条件を確認する。

- Alexaアプリ（スマホ）の「スキル・ゲーム」→「有効なスキル」にスキルが表示されているか
- AlexaコンソールのAmazonアカウントと、Alexaデバイスに紐付いているAmazonアカウントが**同一**か
- テストタブの「テストが有効」がオンになっているか（オンにすると開発中スキルが物理デバイスでも使えるようになる）

条件が揃っていれば、物理デバイスに向かって以下のように話しかける。

```
アレクサ、さくらを開いて
```

---

### Alexaアプリのアクティビティログで音声認識を確認

物理デバイスでうまく動かない場合、Alexaアプリで**実際に何と認識されたか**を確認できる。

1. スマホのAlexaアプリを開く
2. 右下「その他」→「アクティビティ」
3. 失敗した時の履歴をタップして認識テキストを確認する

呼び出し名が別の言葉に変換されている場合は、よりシンプルなひらがな名に変更するとよい。

---

## トラブルシューティング

---

### Groq APIで403エラーが出る

`User-Agent` ヘッダーが不足している可能性がある。以下をリクエストヘッダーに追加する。

```python
"User-Agent": "Mozilla/5.0"
```

---

### Lambdaがタイムアウトする

デフォルトのタイムアウト（3秒）が短すぎる。「設定」→「一般設定」からタイムアウトを**30秒**に変更する。

---

### Alexaが「指定のビデオサービスは～」と返す

呼び出し名が動画・映像系のサービスと誤認識されている。以下を確認する。

- 「AI」「アシスタント」など英語・カタカナを含む呼び出し名は避ける
- Alexaアプリのアクティビティログで**実際にどう認識されたか**を確認する
- 完全なひらがな2〜4音節の呼び出し名に変更する

---

### Qwen3が`<think>`タグ付きで回答する

Qwen3は思考プロセスを出力する場合がある。以下のコードで除去する。

```python
if "</think>" in text:
    text = text.split("</think>")[-1].strip()
```

---

### テストタブでは動くが物理デバイスで動かない

以下を確認する。

- Alexaアプリの「スキル・ゲーム」→「有効なスキル」にスキルが表示されているか
- AlexaコンソールのアカウントとAlexaデバイスのAmazonアカウントが同一か
- テストタブの「テストが有効」がオンになっているか

---

## まとめ

Groq × AWS Lambda × Alexaの連携で、日本語AIアシスタントを構築できた。以下がポイントだ。

- Groqの無料枠（1日1,000件以上）はAlexaの個人利用に十分
- LPUチップによる低レイテンシは音声UIとの相性が良い
- 呼び出し名はひらがな2〜4音節が最も認識精度が高い
- `User-Agent` ヘッダーとタイムアウト設定は必須

Qwen3のシステムプロンプトを変えれば、料理アドバイザーや語学練習相手など用途を自由にカスタマイズできる。

---

## 参考リンク

- [Groq Console](https://console.groq.com)
- [Alexa Skills Kit ドキュメント](https://developer.amazon.com/ja-JP/docs/alexa/ask-overviews/what-is-the-alexa-skills-kit.html)
- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html)
