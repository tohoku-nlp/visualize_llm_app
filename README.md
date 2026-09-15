# Visualize LLM App

このアプリケーションは，大規模言語モデル (LLM) の内部動作を可視化する Web アプリです．<br>
特定の入力に対して，モデルがどのように予測を行っているかを，**Attention Pattern** や **中間層の出力** といった観点から視覚的に理解できます．

本アプリは，東北大学オープンキャンパスにおける研究室展示の一部として開発されたデモ用アプリケーションです．

<p align="center">
  <img src="figures/samples/model_sample.png" width="70%" alt="モデル構造の可視化">
</p>

<p align="center">
  <img src="figures/samples/attention_map_sample.png" width="35%" alt="Attention パターンの可視化">
  <img src="figures/samples/logits_sample.png" width="35%" alt="Logits の可視化">
</p>

## 🔍 主な機能

- 任意のプロンプト入力に対する LLM の出力可視化
- Attention Pattern の可視化（各層・各ヘッド）
- MLP 後の層の状態・Attention Head の出力から読み出した予測ランキングの表示

## 🛠️ セットアップ方法（uv 推奨）

### 1. リポジトリのクローン

```bash
git clone https://github.com/tohoku-nlp/visualize_llm_app.git
cd visualize_llm_app
```

### 2. Python 環境の構築（uv）

[uv](https://docs.astral.sh/uv/) で依存関係をインストールします（Python 3.12）．

```bash
uv sync
```

### 3. React + FastAPI 版の起動（開発）

フロントエンドの起動・ビルドには Node.js と npm も必要です．以下はリポジトリのルートディレクトリから実行します．

バックエンドを起動します．

```bash
uv run uvicorn backend:app --reload --host localhost --port 8000
```

別のターミナルでフロントエンドを起動します．

```bash
cd frontend
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:5178` を開きます．

全層の推論と順位計算が終わるとグラフが表示され，詳細データの生成が済んだ Attention Head / MLP / Output ノードからクリックできるようになります．各ノードの詳細（Attention Pattern / 予測ランキング）は JSON で返され，ブラウザ側で描画されます．

デモでの偶発的な入力ミスを避けるため，`Go` を押すと入力文と期待する次の単語の前後空白を除去し，画面の入力欄にも実際に解析する値を反映します．文中の空白は変更しません．

### 4. 本番配信（uvicorn のみ）

フロントエンドをビルドしておくと，FastAPI がその成果物（`frontend/dist`）を同一オリジンで配信します．uvicorn 1 プロセスだけで UI と API の両方を提供できます．

以下はリポジトリのルートディレクトリから実行します．

```bash
cd frontend
npm install
npm run build
cd ..
uv run uvicorn backend:app --host localhost --port 8000
```

ブラウザで `http://localhost:8000` を開きます．

- ビルド時は `frontend/.env.production` により，API 呼び出しが相対パス（同一オリジン）になります（CORS 不要）．
- 解析ジョブはメモリ上，モデルはプロセスグローバルに保持されるため，**ワーカーは 1 のまま**（`--workers` を付けない）で運用してください．
- (CPU 解析は 1 件ずつ実行され，実行中と待機中を合わせて最大 4 件まで受け付けます．完了・失敗したジョブは内部的に 15 分間，最大 8 件まで保持されます．)

### 5. アプリの終了

各ターミナルで `Ctrl + C` を押して終了してください（ブラウザを閉じるだけでは終了されません）．


## ▶️ アプリの使い方

### 1. プロンプト入力

「入力」欄に任意のプロンプトを入力します．<br>
予測させたい部分が次の単語になるような文にしてください．推奨言語は英語です．<br>
`Ex. Sendai is located in the country of`

💡 **迷ったら「例文からランダムに選ぶ」を押してください．**

- **例文からランダムに選ぶ**：例文をランダムに選び，入力文と期待する次の単語を自動入力します．
- **例文を見て選ぶ**：一覧を開き，クリックした例文と期待する次の単語を自動入力します．

### 2. 答え入力

「期待する次の単語」欄に，入力文に続く答えを入力します．空欄でも解析できますが，正誤判定と順位の表示は行いません．<br>
`Ex. Japan`

### 3. 実行

**Go** を押すと解析が始まります．全層の推論と順位計算が終わるとグラフが表示され，上部の「AI の予測」に予測結果が表示されます．

画面では「単語」と表記していますが，実際に予測するのは次の 1 トークン（単語や単語の一部）です．正誤判定も，期待する答えの先頭トークンとの比較です．

### 4. 詳細を見る

明るくなったノードをクリックすると，Attention Head では「注意パターン」と「予測ランキング」，MLP・Output では「予測ランキング」を表示します．Input には詳細表示がありません．

画面上部の **?** でデモの説明を開けます．説明・例文一覧・ノード詳細は，**✕** または **Esc** キーで閉じられます．

進捗の取得に失敗した場合は，画面の案内に従って接続を確認し，**Go** で再実行してください．

## 📁 ファイル構成（抜粋）

```
.
├── backend.py               # FastAPI バックエンド（API ＋ ビルド済みフロントの配信）
├── frontend/                # React + Vite フロントエンド
│ ├── src/                   #   main.tsx（UI 本体）, styles.css
│ ├── index.html
│ ├── vite.config.ts
│ ├── .env.production        #   本番ビルド用の API ベース（相対パス）
│ └── package.json
├── model.py                 # 推論・キャッシュ取得と次トークンの取り出し
├── logits.py                # 各コンポーネントの logit 計算
├── prompt.py                # プロンプト処理とランダム選択
├── data/
│ ├── prompt_sample.csv      # ランダム選択用のプロンプトと回答
│ └── README.md              # データセットの説明
├── docs/                    # デモ用ガイド（PDF）
├── figures/samples/         # README 用のサンプル画像
├── pyproject.toml           # プロジェクト定義・依存関係（uv）
├── uv.lock                  # 依存関係のロックファイル
└── README.md                # 本ファイル
```

## ⚙️ 主なライブラリ

- Python 3.12（`requires-python >= 3.10`）
- 環境管理: uv
- バックエンド: FastAPI / Uvicorn / TransformerLens (v2.16.1) / PyTorch (v2.7.1)
- フロントエンド: React 18 / Vite 6 / TypeScript

## 元リポジトリについて

本リポジトリは，[Fukata-K/visualize_llm_app](https://github.com/Fukata-K/visualize_llm_app) をもとに，UI 部分を Streamlit から React + FastAPI 構成へ換装したものです．
