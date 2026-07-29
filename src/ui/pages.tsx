import { product } from "../config/product";
import { Layout } from "./layout";

function DemoMember({
  car = "",
  name,
  state,
}: {
  car?: string;
  name: string;
  state: "maybe" | "no" | "yes";
}) {
  return (
    <article class="demo-member" data-state={state}>
      <span class="member-dot" aria-hidden="true"></span>
      <strong>{name}</strong>
      <small>{state === "yes" ? "参加" : state === "maybe" ? "未定" : "欠席"}</small>
      {car ? <b>{car}</b> : null}
    </article>
  );
}

export function HomePage() {
  return (
    <Layout>
      <section class="field-demo" aria-label="のりあい表の利用イメージ">
        <div class="field-board">
          <header>
            <span class="date-chip">8/9 SUN</span>
            <div>
              <small>練習試合</small>
              <strong>河川敷グラウンド</strong>
            </div>
            <span class="score-chip">7 / 9</span>
          </header>
          <div class="pitch">
            <i class="center-line"></i>
            <span class="player p1">ゆう</span>
            <span class="player p2">れん</span>
            <span class="player p3">あお</span>
            <span class="player p4">かい</span>
            <span class="player p5">そら</span>
            <span class="player p6 empty">?</span>
            <span class="player p7 empty">?</span>
          </div>
          <div class="member-strip">
            <DemoMember car="3席" name="ゆう" state="yes" />
            <DemoMember car="2人" name="れん" state="yes" />
            <DemoMember name="あお" state="maybe" />
            <DemoMember name="みな" state="no" />
          </div>
        </div>
        <aside class="ride-balance">
          <header>
            <span aria-hidden="true">▰</span>
            <strong>送迎バランス</strong>
          </header>
          <div class="balance-row">
            <span>空いている席</span>
            <b>3</b>
          </div>
          <div class="seat-track">
            <i></i>
            <i></i>
            <i></i>
            <i class="dim"></i>
          </div>
          <div class="balance-row">
            <span>乗せてほしい</span>
            <b>2</b>
          </div>
          <div class="balance-result">
            <span aria-hidden="true">✓</span>
            あと1席あります
          </div>
        </aside>
      </section>

      <section class="maker-shell" id="create">
        <div class="maker-intro">
          <span class="eyebrow">ONE EVENT / NO ACCOUNT</span>
          <h1>{product.headline}</h1>
          <p>次の練習や試合だけ。LINEにURLを流せば、出欠と送迎の不足が見えるようになります。</p>
          <ul>
            <li>
              <span>01</span>参加・未定・欠席を集計
            </li>
            <li>
              <span>02</span>車の空席と希望人数を照合
            </li>
            <li>
              <span>03</span>本名・連絡先なし、21日で削除
            </li>
          </ul>
        </div>
        <form class="maker" id="create-form">
          <header>
            <span class="mini-board" aria-hidden="true"></span>
            <div>
              <small>NEW BOARD</small>
              <h2>次の予定をつくる</h2>
            </div>
          </header>
          <label class="field">
            <span>予定の名前</span>
            <input id="title" maxlength={50} placeholder="日曜の練習試合" required />
          </label>
          <div class="field-pair">
            <label class="field">
              <span>日付</span>
              <input id="event-date" required type="date" />
            </label>
            <label class="field">
              <span>集合</span>
              <input id="meet-time" required type="time" />
            </label>
          </div>
          <label class="field">
            <span>集合場所</span>
            <input id="place" maxlength={60} placeholder="河川敷グラウンド入口" required />
          </label>
          <div class="field-pair">
            <label class="field">
              <span>競技</span>
              <select id="sport">
                <option value="soccer">サッカー・フットサル</option>
                <option value="basketball">バスケットボール</option>
                <option value="baseball">野球・ソフトボール</option>
                <option value="volleyball">バレーボール</option>
                <option value="other">その他</option>
              </select>
            </label>
            <label class="field">
              <span>必要人数</span>
              <input id="expected-count" max={50} min={1} required type="number" value={9} />
            </label>
          </div>
          <label class="honeypot" aria-hidden="true">
            Website
            <input id="website" tabindex={-1} />
          </label>
          <button class="button primary" id="create-button" type="submit">
            回答URLをつくる
            <span aria-hidden="true">→</span>
          </button>
          <p class="action-status" id="create-status" aria-live="polite"></p>
        </form>
      </section>
      <script src="/home.js?v=1" type="module"></script>
    </Layout>
  );
}

function SummaryTiles() {
  return (
    <div class="summary-tiles">
      <article>
        <span class="status-dot yes"></span>
        <small>参加</small>
        <strong id="yes-count">0</strong>
      </article>
      <article>
        <span class="status-dot maybe"></span>
        <small>未定</small>
        <strong id="maybe-count">0</strong>
      </article>
      <article>
        <span class="status-dot no"></span>
        <small>欠席</small>
        <strong id="no-count">0</strong>
      </article>
      <article class="ride-tile">
        <small>空席 / 希望</small>
        <strong>
          <span id="seat-count">0</span> / <span id="need-count">0</span>
        </strong>
      </article>
    </div>
  );
}

export function EventPage({ eventId, title }: { eventId: string; title: string }) {
  return (
    <Layout
      bodyClass="private-page"
      canonical={`${product.url}/e/${eventId}`}
      noindex
      title={`${title} | ${product.name}`}
    >
      <section class="event-shell" data-event-id={eventId} id="event-app">
        <header class="event-heading">
          <div class="event-date" id="event-date-label">
            --
          </div>
          <div>
            <span class="eyebrow" id="event-sport">
              TEAM EVENT
            </span>
            <h1 id="event-title">{title}</h1>
            <p>
              <span id="event-time">--:--</span> 集合・<span id="event-place">---</span>
            </p>
          </div>
          <span class="state-pill" id="event-state">
            回答受付中
          </span>
        </header>
        <SummaryTiles />
        <div class="response-grid">
          <section class="balance-panel">
            <header>
              <span>RIDE BALANCE</span>
              <strong id="balance-label">回答を待っています</strong>
            </header>
            <div class="car-visual" aria-hidden="true">
              <span class="car-body">
                <i></i>
                <i></i>
                <b></b>
                <em></em>
              </span>
              <div class="seat-visual" id="seat-visual"></div>
            </div>
            <p>個別の名前とメモは幹事だけに表示されます。</p>
          </section>
          <form class="response-card" id="response-form">
            <header>
              <small>YOUR ANSWER</small>
              <h2>この予定に回答する</h2>
            </header>
            <label class="field">
              <span>呼び名・イニシャル</span>
              <input id="name" maxlength={20} placeholder="ゆう家" required />
            </label>
            <fieldset class="segmented">
              <legend>出欠</legend>
              <label>
                <input checked name="attendance" type="radio" value="yes" />
                <span>参加</span>
              </label>
              <label>
                <input name="attendance" type="radio" value="maybe" />
                <span>未定</span>
              </label>
              <label>
                <input name="attendance" type="radio" value="no" />
                <span>欠席</span>
              </label>
            </fieldset>
            <fieldset class="segmented ride-choice">
              <legend>移動</legend>
              <label>
                <input checked name="ride" type="radio" value="self" />
                <span>自分で行く</span>
              </label>
              <label>
                <input name="ride" type="radio" value="offer" />
                <span>車を出せる</span>
              </label>
              <label>
                <input name="ride" type="radio" value="need" />
                <span>乗せてほしい</span>
              </label>
            </fieldset>
            <label class="field conditional-field" hidden id="seats-field">
              <span>ほかに乗せられる人数</span>
              <input id="seats" max={8} min={1} type="number" value={1} />
            </label>
            <label class="field conditional-field" hidden id="passengers-field">
              <span>乗せてほしい人数</span>
              <input id="passengers" max={4} min={1} type="number" value={1} />
            </label>
            <label class="field">
              <span>
                幹事へのメモ <small>任意・全員には見えません</small>
              </span>
              <textarea
                id="note"
                maxlength={100}
                placeholder="帰りだけ乗せてほしいです"
                rows={2}
              ></textarea>
            </label>
            <label class="honeypot" aria-hidden="true">
              Website
              <input id="response-website" tabindex={-1} />
            </label>
            <button class="button primary" id="save-button" type="submit">
              回答を保存
              <span aria-hidden="true">→</span>
            </button>
            <p class="action-status" id="response-status" aria-live="polite"></p>
          </form>
        </div>
        <button class="report-link" id="report-button" type="button">
          この予定を報告
        </button>
      </section>
      <script src="/event.js?v=1" type="module"></script>
    </Layout>
  );
}

export function ManagePage({ eventId, title }: { eventId: string; title: string }) {
  return (
    <Layout
      bodyClass="private-page"
      canonical={`${product.url}/manage/${eventId}`}
      noindex
      title={`管理 | ${title} | ${product.name}`}
    >
      <section class="manage-shell" data-event-id={eventId} id="manage-app">
        <header class="manage-header">
          <div>
            <span class="eyebrow">TEAM DESK</span>
            <h1>{title}</h1>
            <p id="manage-meta">予定を読み込んでいます</p>
          </div>
          <span class="state-pill" id="manage-state">
            回答受付中
          </span>
        </header>
        <div class="owner-links">
          <article>
            <span>01</span>
            <div>
              <small>チームへ共有</small>
              <strong>回答URL</strong>
            </div>
            <button class="button compact" id="copy-event" type="button">
              コピー
            </button>
          </article>
          <article>
            <span>02</span>
            <div>
              <small>この端末へ保存</small>
              <strong>管理URL</strong>
            </div>
            <button class="button compact" id="copy-owner" type="button">
              コピー
            </button>
          </article>
        </div>
        <SummaryTiles />
        <div class="manage-grid">
          <section class="roster-panel">
            <header>
              <span>ROSTER</span>
              <strong id="response-total">0件</strong>
              <button class="text-button" id="refresh-button" type="button">
                更新
              </button>
            </header>
            <div class="roster-list" id="roster-list">
              <p class="empty-state">まだ回答はありません。</p>
            </div>
          </section>
          <aside class="ride-panel">
            <header>
              <span>RIDE BOARD</span>
              <strong id="ride-result">回答待ち</strong>
            </header>
            <div class="ride-columns">
              <section>
                <h2>車を出せる</h2>
                <div id="offer-list"></div>
              </section>
              <section>
                <h2>乗せてほしい</h2>
                <div id="need-list"></div>
              </section>
            </div>
          </aside>
        </div>
        <div class="manage-actions">
          <button class="button compact" id="csv-button" type="button">
            CSVを保存
          </button>
          <button class="button compact" id="toggle-button" type="button">
            回答を締め切る
          </button>
          <button class="text-button danger" id="delete-button" type="button">
            予定を削除
          </button>
        </div>
        <p class="action-status" id="manage-message" aria-live="polite"></p>
      </section>
      <script src="/manage.js?v=1" type="module"></script>
    </Layout>
  );
}

export function GuidePage() {
  return (
    <Layout title={`使い方 | ${product.name}`}>
      <article class="guide-board">
        <header>
          <span class="eyebrow">ONE SHARED BOARD</span>
          <h1>LINEに一つ、回答URLを流す。</h1>
          <p>アプリの追加やメンバー登録なしで、次の予定だけを整理します。</p>
        </header>
        <ol class="guide-steps">
          <li>
            <span>01</span>
            <div class="guide-icon">▤</div>
            <h2>幹事が予定を作る</h2>
            <p>日付、集合、場所、必要人数を入れ、回答URLを既存の連絡先へ共有します。</p>
          </li>
          <li>
            <span>02</span>
            <div class="guide-icon">✓</div>
            <h2>各家庭が回答する</h2>
            <p>呼び名、出欠、車の空席または希望人数を登録なしで回答します。</p>
          </li>
          <li>
            <span>03</span>
            <div class="guide-icon">▰</div>
            <h2>幹事が組み合わせる</h2>
            <p>名前とメモは管理画面だけで確認し、空席と希望人数を調整します。</p>
          </li>
        </ol>
        <section class="guide-note">
          <strong>緊急連絡には使わないでください</strong>
          <p>
            通知や到達保証はありません。集合変更や安全に関わる連絡は、電話や普段の連絡網も使ってください。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout title={`プライバシー | ${product.name}`}>
      <article class="prose">
        <header>
          <span class="eyebrow">PRIVACY</span>
          <h1>必要なのは、呼び名と人数だけ。</h1>
        </header>
        <section>
          <h2>保存するもの</h2>
          <p>
            予定名、日付、集合時刻、場所、必要人数、回答者の呼び名、出欠、空席・希望人数、任意メモを保存します。本名、児童名、住所、電話番号、メール、写真は入力しないでください。
          </p>
        </section>
        <section>
          <h2>見える範囲</h2>
          <p>
            回答ページに表示するのは集計数だけです。個別の呼び名とメモは秘密鍵つき管理URLでだけ確認できます。
          </p>
        </section>
        <section>
          <h2>削除と計測</h2>
          <p>
            予定、回答、匿名の操作記録は21日後に削除します。Cookie、IPアドレス、User-Agentを保存せず、本文を計測データへ含めません。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout noindex title={`見つかりません | ${product.name}`}>
      <section class="not-found">
        <span>404</span>
        <h1>この予定は見つかりません。</h1>
        <p>URLが違うか、削除または21日を過ぎた可能性があります。</p>
        <a class="button compact" href="/">
          トップへ戻る
        </a>
      </section>
    </Layout>
  );
}
