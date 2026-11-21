// ===== 1. 画面の部品を取ってくる =====
// id（名札）を使って、HTMLの部品を1つずつ取ってきて「変数」という箱に入れる
const form = document.getElementById("expense-form");
const dateInput = document.getElementById("date");
const categoryInput = document.getElementById("category");
const amountInput = document.getElementById("amount");
const memoInput = document.getElementById("memo");
const list = document.getElementById("expense-list");
const totalText = document.getElementById("total");

// カレンダーの部品
const monthLabel = document.getElementById("month-label");
const prevMonthButton = document.getElementById("prev-month");
const nextMonthButton = document.getElementById("next-month");
const calendarDays = document.getElementById("calendar-days");
const dayTitle = document.getElementById("day-title");

// 分類ごとの集計の部品
const summaryMonth = document.getElementById("summary-month");
const categorySummary = document.getElementById("category-summary");
const pieChart = document.getElementById("pie-chart");
const pieTotal = document.getElementById("pie-total");

// 分類ごとの色。分類と色を1対1で決めておくと、月を変えても「食費＝青」のまま変わらない
const CATEGORY_COLORS = {
  "食費": "#2a78d6",       // 青
  "日用品": "#eb6834",     // オレンジ
  "交通費": "#1baf7a",     // 水色がかった緑
  "趣味・娯楽": "#eda100", // 黄色
  "外食": "#e87ba4",       // ピンク
  "その他": "#9a9893",     // グレー
};
// 上の表にない分類（あとで分類を増やしたとき）に使う色
const DEFAULT_COLOR = "#6250d6"; // 紫

// 削除の確認ダイアログの部品
const deleteDialog = document.getElementById("delete-dialog");
const deleteMessage = document.getElementById("delete-message");
const cancelDeleteButton = document.getElementById("cancel-delete");
const confirmDeleteButton = document.getElementById("confirm-delete");

// 詳細・編集ダイアログの部品
const detailDialog = document.getElementById("detail-dialog");
const editForm = document.getElementById("edit-form");
const editDate = document.getElementById("edit-date");
const editCategory = document.getElementById("edit-category");
const editAmount = document.getElementById("edit-amount");
const editMemo = document.getElementById("edit-memo");
const closeDetailButton = document.getElementById("close-detail");
const detailTitle = document.getElementById("detail-title");
const editFields = document.getElementById("edit-fields");
const viewButtons = document.getElementById("view-buttons");
const editButtons = document.getElementById("edit-buttons");
const startEditButton = document.getElementById("start-edit");
const cancelEditButton = document.getElementById("cancel-edit");

// 分類の選択肢を、上の入力フォームからそのままコピーする
// （分類を増やすときは index.html の上のフォーム1か所だけ直せばよい）
editCategory.innerHTML = categoryInput.innerHTML;

// 「どの出費を編集しているか」を覚えておく箱
let expenseToEdit = null;

// 「どの出費を消そうとしているか」を覚えておく箱（何も選んでいないときは null）
let expenseToDelete = null;

// ===== 2. 出費のデータを入れておく箱 =====
// 保存しておく場所（ブラウザの中）での名前
const STORAGE_KEY = "kakeibo-expenses";

// ブラウザに保存されているデータを読み込む。何もなければ空の配列 [] から始める
let expenses = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// ===== 3. データを保存する関数 =====
function save() {
  // 配列を文字に変換して（JSON.stringify）、ブラウザに保存する
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

// ===== 4. 画面に表示している状態を覚えておく箱 =====
let viewYear = 0;        // 表示している年（例: 2026）
let viewMonth = 0;       // 表示している月（1〜12）
let selectedDate = null; // 選んでいる日（例: "2026-11-21"）。選んでいなければ null

// ===== 便利な関数 =====
// 年・月・日から "2026-11-05" の形の文字を作る
function toDateString(year, month, day) {
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

// 金額を "1,200" のように3桁ごとにカンマを入れた文字にする
function formatYen(amount) {
  return amount.toLocaleString();
}

// 出費の配列の、金額の合計を計算する
function sumAmount(items) {
  let total = 0;
  for (const expense of items) {
    total = total + expense.amount;
  }
  return total;
}

// 指定した日付の月を表示して、その日を選んだ状態にする
function showDate(dateString) {
  viewYear = Number(dateString.slice(0, 4));  // "2026-11-21" の最初の4文字
  viewMonth = Number(dateString.slice(5, 7)); // 6〜7文字目
  selectedDate = dateString;
  render();
}

// 表示する月を前後に動かす（diff が -1 なら前の月、1 なら次の月）
function changeMonth(diff) {
  // Date に「13月」や「0月」を渡すと、自動で年をまたいで計算してくれる
  const date = new Date(viewYear, viewMonth - 1 + diff, 1);
  viewYear = date.getFullYear();
  viewMonth = date.getMonth() + 1;

  // 今日がその月なら今日を選ぶ。違う月なら何も選ばない
  selectedDate = today.startsWith(toDateString(viewYear, viewMonth, 1).slice(0, 7)) ? today : null;
  render();
}

// ===== 5. データをもとに、カレンダーと一覧を画面に描く関数 =====
function render() {
  // 表示している月（例: "2026-11"）
  const monthKey = toDateString(viewYear, viewMonth, 1).slice(0, 7);
  monthLabel.textContent = viewYear + "年" + viewMonth + "月";

  // その月の出費だけを取り出す（日付 "2026-11-21" が "2026-11" で始まるもの）
  const monthExpenses = expenses.filter(function (expense) {
    return expense.date.startsWith(monthKey);
  });
  totalText.textContent = formatYen(sumAmount(monthExpenses));

  renderCalendar(monthExpenses);
  renderDayList(monthExpenses);
  renderSummary(monthExpenses);
}

// 分類ごとの合計を計算して、棒グラフを作る関数
function renderSummary(monthExpenses) {
  summaryMonth.textContent = viewMonth + "月";
  categorySummary.textContent = ""; // いったん空にする

  // この月に1件もなければ、円グラフを隠して、そのことを表示して終わる
  if (monthExpenses.length === 0) {
    pieChart.hidden = true;
    categorySummary.textContent = "この月の出費はまだありません";
    return;
  }
  pieChart.hidden = false;

  // --- (1) 分類ごとに金額を足していく ---
  // totals は「分類の名前 → 合計金額」を覚えておく箱（オブジェクト）
  // 例: { "食費": 3200, "交通費": 840 }
  const totals = {};
  for (const expense of monthExpenses) {
    if (totals[expense.category] === undefined) {
      totals[expense.category] = 0; // 初めて出てきた分類は 0 から始める
    }
    totals[expense.category] = totals[expense.category] + expense.amount;
  }

  // --- (2) 金額の大きい順に並べる ---
  // Object.keys(totals) で分類の名前だけの配列を作る → ["食費", "交通費"]
  const categories = Object.keys(totals);
  // sort は並べ替え。b − a が正なら b を前にする ＝ 大きい順
  categories.sort(function (a, b) {
    return totals[b] - totals[a];
  });

  // --- (3) 円グラフの塗り分けを作る ---
  const monthTotal = sumAmount(monthExpenses); // 月の合計（割合の計算に使う）
  pieTotal.textContent = formatYen(monthTotal);

  // conic-gradient は「円の真上から時計回りに、何%から何%までを何色で塗るか」を並べる書き方
  // 例: conic-gradient(#2a78d6 0% 60%, #eb6834 60% 100%) → 青が6割、オレンジが4割
  const parts = [];  // "色 開始% 終了%" を1分類ずつ入れていく配列
  let start = 0;     // 今の分類が何%の位置から始まるか
  for (const category of categories) {
    const end = start + totals[category] / monthTotal * 100;
    parts.push(colorOf(category) + " " + start + "% " + end + "%");
    start = end;     // 次の分類は、今の分類が終わった位置から始まる
  }
  // parts.join(", ") で配列を「, 」でつないで1つの文字にする
  pieChart.style.background = "conic-gradient(" + parts.join(", ") + ")";

  // --- (4) 色の説明（凡例）と金額を1分類ずつ並べる ---
  for (const category of categories) {
    const amount = totals[category];
    // 月の合計に対する割合（%）。Math.round で四捨五入して整数にする
    const percent = Math.round(amount / monthTotal * 100);

    const row = document.createElement("div");
    row.className = "summary-row";

    // 色の見本（小さな丸）
    const swatch = document.createElement("span");
    swatch.className = "summary-swatch";
    swatch.style.backgroundColor = colorOf(category);

    const name = document.createElement("span");
    name.className = "summary-name";
    name.textContent = category;

    const value = document.createElement("span");
    value.textContent = formatYen(amount) + "円（" + percent + "%）";

    row.appendChild(swatch);
    row.appendChild(name);
    row.appendChild(value);
    categorySummary.appendChild(row);
  }
}

// 分類の色を返す関数（表にない分類なら DEFAULT_COLOR）
function colorOf(category) {
  return CATEGORY_COLORS[category] || DEFAULT_COLOR;
}

// カレンダーのマスを作る関数
function renderCalendar(monthExpenses) {
  calendarDays.textContent = ""; // いったん空にする

  // 1日が何曜日か（0 = 日曜 〜 6 = 土曜）
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  // その月が何日まであるか（「次の月の0日」＝「この月の最終日」になる）
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  // 1日より前の空きマス（例: 1日が水曜なら、日・月・火の3マス）
  for (let i = 0; i < firstWeekday; i++) {
    calendarDays.appendChild(document.createElement("div"));
  }

  // 1日から最終日まで、1マスずつ作る
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = toDateString(viewYear, viewMonth, day);

    // その日の出費の合計
    const dayTotal = sumAmount(monthExpenses.filter(function (expense) {
      return expense.date === dateString;
    }));

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day";

    // 曜日・今日・選んでいる日によって、見た目用の class を足す
    const weekday = (firstWeekday + day - 1) % 7; // % は「割った余り」
    if (weekday === 0) cell.classList.add("sun");
    if (weekday === 6) cell.classList.add("sat");
    if (dateString === today) cell.classList.add("today");
    if (dateString === selectedDate) cell.classList.add("selected");

    // 日付の数字
    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    // 出費があれば、その日の合計を小さく表示
    if (dayTotal > 0) {
      const amount = document.createElement("span");
      amount.className = "day-amount";
      amount.textContent = formatYen(dayTotal);
      cell.appendChild(amount);
    }

    // マスを押したら、その日を選んで描き直す
    cell.addEventListener("click", function () {
      selectedDate = dateString;
      render();
    });

    calendarDays.appendChild(cell);
  }
}

// 選んだ日の出費一覧を作る関数
function renderDayList(monthExpenses) {
  list.textContent = ""; // いったん一覧を空にする

  // 日を選んでいない、または選んだ日がこの月でないとき
  if (selectedDate === null || !selectedDate.startsWith(toDateString(viewYear, viewMonth, 1).slice(0, 7))) {
    dayTitle.textContent = "日付を押すと、その日の出費が表示されます";
    return;
  }

  // 選んだ日の出費だけを取り出す
  const dayExpenses = monthExpenses.filter(function (expense) {
    return expense.date === selectedDate;
  });

  const day = Number(selectedDate.slice(8, 10));
  dayTitle.textContent =
    viewMonth + "月" + day + "日（" + dayExpenses.length + "件）" +
    formatYen(sumAmount(dayExpenses)) + "円";

  // 1件もなければ、そのことを表示する
  if (dayExpenses.length === 0) {
    const item = document.createElement("li");
    item.textContent = "この日の出費はまだありません";
    list.appendChild(item);
  }

  // 配列の中身を1件ずつ取り出して、1行ずつ作る
  for (const expense of dayExpenses) {
    const item = document.createElement("li"); // 新しい <li> を作る

    // 出費の内容を表示する部分（日付は見出しにあるので、分類と金額だけ）
    const text = document.createElement("span");
    text.textContent = expense.category + "　" + formatYen(expense.amount) + "円";

    // 詳細ボタン
    const detailButton = document.createElement("button");
    detailButton.textContent = "詳細";
    detailButton.className = "detail-button";

    // 詳細ボタンが押されたら、「見るだけ」の状態でダイアログを出す
    detailButton.addEventListener("click", function () {
      expenseToEdit = expense; // どの出費を表示しているか覚えておく
      fillDetail();            // 今の内容を入力欄に入れる
      setEditMode(false);      // 見るだけの状態にする
      detailDialog.showModal();
    });

    // 削除ボタン
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.className = "delete-button"; // CSS で見た目を変えるための class

    // 削除ボタンが押されたら、すぐには消さずに確認ダイアログを出す
    deleteButton.addEventListener("click", function () {
      expenseToDelete = expense;                    // 消す候補を覚えておく
      deleteMessage.textContent = expense.date + "　" + text.textContent; // ダイアログに内容を表示
      deleteDialog.showModal();                     // ダイアログを画面中央に出す
    });

    item.appendChild(text);         // <li> の中に内容を入れる
    item.appendChild(detailButton); // <li> の中に詳細ボタンを入れる（削除の左）
    item.appendChild(deleteButton); // <li> の中に削除ボタンを入れる
    list.appendChild(item);         // 一覧（<ul>）の最後に入れる
  }
}

// ===== 6. 「追加する」が押されたときの処理 =====
form.addEventListener("submit", function (event) {
  // フォームの標準の動き（ページのリセット）を止める
  event.preventDefault();

  // 入力欄の値を、1件分のデータ（オブジェクト）にまとめる
  const expense = {
    date: dateInput.value,
    category: categoryInput.value,
    amount: Number(amountInput.value), // 文字を「数」に変換する
    memo: memoInput.value,
  };

  expenses.push(expense);  // 配列の最後に追加する
  save();                  // ブラウザに保存する
  showDate(expense.date);  // 追加した日のカレンダーを表示して、その日を選ぶ

  // 次の入力に備えて、金額とメモの欄を空にする
  amountInput.value = "";
  memoInput.value = "";
});

// ===== 詳細・編集ダイアログ =====
// 覚えておいた出費の内容を、入力欄に入れる関数
function fillDetail() {
  editDate.value = expenseToEdit.date;
  editCategory.value = expenseToEdit.category;
  editAmount.value = expenseToEdit.amount;
  editMemo.value = expenseToEdit.memo;
}

// 「見るだけ」と「編集中」を切り替える関数（isEditing が true なら編集中）
function setEditMode(isEditing) {
  editFields.disabled = !isEditing;  // 編集中だけ入力できるようにする
  viewButtons.hidden = isEditing;    // 編集中は「閉じる・編集する」を隠す
  editButtons.hidden = !isEditing;   // 編集中だけ「キャンセル・保存する」を出す
  detailTitle.textContent = isEditing ? "出費を編集" : "出費の詳細";
}

// 「閉じる」：ダイアログを閉じる
closeDetailButton.addEventListener("click", function () {
  expenseToEdit = null;
  detailDialog.close();
});

// 「編集する」：入力できる状態にする
startEditButton.addEventListener("click", function () {
  setEditMode(true);
  editAmount.focus(); // 金額の欄にカーソルを置いておく
});

// 「キャンセル」：書きかけの内容を元に戻して、見るだけの状態に戻る
cancelEditButton.addEventListener("click", function () {
  fillDetail();
  setEditMode(false);
});

// 「保存する」：入力欄の内容で、覚えておいた出費を書き換える
editForm.addEventListener("submit", function (event) {
  event.preventDefault(); // ページのリセットを止める

  expenseToEdit.date = editDate.value;
  expenseToEdit.category = editCategory.value;
  expenseToEdit.amount = Number(editAmount.value); // 文字を「数」に変換する
  expenseToEdit.memo = editMemo.value;

  save();                      // 保存する
  showDate(expenseToEdit.date); // 編集後の日付を表示する（日付を変えた場合もそこへ移る）

  expenseToEdit = null;
  detailDialog.close();
});

// ===== 削除ダイアログのボタン =====
// 「キャンセル」：ダイアログを閉じるだけ
cancelDeleteButton.addEventListener("click", function () {
  expenseToDelete = null;
  deleteDialog.close();
});

// 「削除する」：覚えておいた出費を配列から取り除く
confirmDeleteButton.addEventListener("click", function () {
  const index = expenses.indexOf(expenseToDelete); // 何番目にあるか調べる
  if (index !== -1) {           // 見つかったときだけ（見つからないと -1 になる）
    expenses.splice(index, 1);  // その位置から1件取り除く
    save();                     // 保存する
    render();                   // 画面を描き直す
  }
  expenseToDelete = null;
  deleteDialog.close();
});

// ===== レシートの読み取り（Tesseract.js） =====
const receiptInput = document.getElementById("receipt-input");
const receiptButton = receiptInput.parentElement; // ボタンの見た目をしている <label>
const ocrStatus = document.getElementById("ocr-status");
const ocrProgress = document.getElementById("ocr-progress");
const receiptPreview = document.getElementById("receipt-preview");
const ocrDetails = document.getElementById("ocr-details");
const ocrText = document.getElementById("ocr-text");

// 文字を読む係（ワーカー）。作るのに時間がかかるので、1回作ったら使い回す
let ocrWorker = null;

// 進み具合を画面に出す関数（Tesseract.js が何度も呼んでくれる）
function showOcrProgress(message) {
  // message.status は英語の「今やっていること」、message.progress は 0〜1 の進み具合
  const names = {
    "loading tesseract core": "準備中…",
    "initializing tesseract": "準備中…",
    "loading language traineddata": "日本語のデータを読み込み中…（初回だけ少し時間がかかります）",
    "initializing api": "準備中…",
    "recognizing text": "文字を読み取り中…",
  };
  ocrStatus.textContent = names[message.status] || "準備中…";
  ocrProgress.value = message.progress;
}

// 写真ファイルを、画面に出せる「画像」にする関数
// new Promise(...) は「終わったら知らせる約束」。画像の読み込みは少し時間がかかるので、
// 読み込み終わったら resolve（成功）、失敗したら reject（失敗）で知らせる
function loadImage(file) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload = function () { resolve(image); };
    image.onerror = reject;
    // URL.createObjectURL で、スマホの中の写真に一時的な住所（URL）を付ける
    image.src = URL.createObjectURL(file);
  });
}

// 読み取りやすいように写真を整える関数（小さくする・白黒にする）
// スマホの写真はとても大きいので、そのままだと読み取りに何分もかかってしまう
function prepareImage(image) {
  const MAX_SIZE = 2000; // 長いほうの辺をこの大きさ（ピクセル）までにする
  const scale = Math.min(1, MAX_SIZE / Math.max(image.width, image.height));

  // <canvas> は絵を描ける画用紙。ここに写真を縮めて描く
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // 1つ1つの点（ピクセル）の色を、白黒の濃さに変える
  // data には点ごとに [赤, 緑, 青, 透明度] の4つの数が順番に並んでいる
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    // 人の目に近い割合で混ぜて、明るさ（0=黒〜255=白）にする
    let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // コントラストを強めて、文字をくっきりさせる（明るい所はより白く、暗い所はより黒く）
    gray = (gray - 128) * 1.5 + 128;
    data[i] = data[i + 1] = data[i + 2] = gray; // 255を超えた分などは自動でおさまる
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

// 読み取った文字を、探しやすい形にそろえる関数
function normalizeText(text) {
  return text
    // 全角の数字「１２３」を半角の「123」にする（文字の番号を一定の数だけずらす）
    .replace(/[０-９]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    })
    .replace(/[，、]/g, ",")
    .replace(/[／]/g, "/")
    // 日本語の読み取りでは「合 計」のように間にすき間が入りがちなので、すき間を消す
    .replace(/[ 　\t]/g, "")
    // 「1.980」のようにカンマが点に読まれたものを「1,980」に直す
    .replace(/(\d)\.(\d{3})(?!\d)/g, "$1,$2");
}

// 1行の中から金額を探す関数。いちばん右の数を金額とみなす
function findAmountInLine(line) {
  // 「3点」のような買った数は金額ではないので先に消す
  const cleaned = line.replace(/\d+点/g, "");
  // \d[\d,]* = 数字で始まり、数字かカンマが続く部分。 g = 全部探す
  const numbers = cleaned.match(/\d[\d,]*/g);
  if (numbers === null) return null;
  const amount = Number(numbers[numbers.length - 1].replace(/,/g, ""));
  return amount > 0 ? amount : null;
}

// レシートの文字から合計金額を探す関数
function findTotal(lines) {
  // 上から順に試す言葉。「合計」がいちばん確実なので先に探す
  const keywords = ["合計", "お買上", "お買い上げ", "ご請求", "お支払"];
  for (const keyword of keywords) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 「小計」は合計ではないので飛ばす
      if (!line.includes(keyword) || line.includes("小計")) continue;
      // その行に数があればそれ。なければ金額が次の行にあることも多いので、次の行を見る
      const amount = findAmountInLine(line) || findAmountInLine(lines[i + 1] || "");
      if (amount !== null) return amount;
    }
  }
  return null; // 見つからなかった
}

// レシートの文字から日付を探して "2026-11-21" の形で返す関数
function findDate(text) {
  // 例: 2026年11月21日 / 2026/11/21 / 2026.11.21 / 2026-11-21
  let match = text.match(/(20\d\d)[年\/\.\-](\d{1,2})[月\/\.\-](\d{1,2})/);
  let year;
  if (match !== null) {
    year = Number(match[1]);
  } else {
    // 例: 令和8年11月21日（令和1年 = 2019年 なので、2018 を足す）
    match = text.match(/令和(\d{1,2})年(\d{1,2})月(\d{1,2})日/);
    if (match === null) return null;
    year = 2018 + Number(match[1]);
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  // ありえない月日（読み間違い）なら使わない
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return toDateString(year, month, day);
}

// 写真が選ばれたときの処理
// async を付けた関数の中では、await で「時間のかかる処理が終わるまで待つ」ことができる
receiptInput.addEventListener("change", async function () {
  const file = receiptInput.files[0];
  if (!file) return; // 選ぶのをやめたときは何もしない

  // ライブラリが読み込めていない（ネットにつながっていない など）
  if (typeof Tesseract === "undefined") {
    ocrStatus.hidden = false;
    ocrStatus.textContent = "読み取りの仕組みを読み込めませんでした。ネットにつながっているか確かめてください。";
    receiptInput.value = "";
    return;
  }

  // 読み取り中の見た目にする
  receiptButton.classList.add("busy");
  ocrStatus.hidden = false;
  ocrStatus.textContent = "写真を準備中…";
  ocrProgress.hidden = false;
  ocrProgress.value = 0;
  ocrDetails.hidden = true;

  try {
    const image = await loadImage(file);
    receiptPreview.src = image.src;
    receiptPreview.hidden = false;

    // 文字を読む係を、まだいなければ作る（日本語 = "jpn"）
    if (ocrWorker === null) {
      ocrWorker = await Tesseract.createWorker("jpn", 1, { logger: showOcrProgress });
    }
    // 整えた写真を読み取ってもらう。結果の data.text に読み取った文字が入っている
    const result = await ocrWorker.recognize(prepareImage(image));
    const text = result.data.text;

    // 読み取った文字をそのまま見られるようにする
    ocrText.textContent = text;
    ocrDetails.hidden = false;

    // 1行ずつに分けて（split）、すき間をそろえてから、合計と日付を探す
    const lines = text.split("\n").map(normalizeText);
    const total = findTotal(lines);
    const date = findDate(lines.join("\n"));

    // 見つかったものを入力フォームに入れる
    if (total !== null) amountInput.value = total;
    if (date !== null) dateInput.value = date;

    // 結果のお知らせ。最後は自分で確かめて「追加する」を押してもらう
    if (total !== null && date !== null) {
      ocrStatus.textContent = "読み取りました！金額と日付が合っているか確かめて「追加する」を押してください。";
    } else if (total !== null) {
      ocrStatus.textContent = "金額を読み取りました（日付は見つからなかったので、確かめてください）。";
    } else {
      ocrStatus.textContent = "合計金額が見つかりませんでした。「読み取った文字を見る」を参考に、手で入力してください。";
    }
  } catch (error) {
    console.error(error); // くわしい原因は開発者ツールに出す
    ocrStatus.textContent = "読み取りに失敗しました。もう一度試すか、手で入力してください。";
  } finally {
    // うまくいってもいかなくても、最後に必ずやること
    receiptButton.classList.remove("busy");
    ocrProgress.hidden = true;
    receiptInput.value = ""; // 同じ写真をもう一度選んでも動くように、選んだ状態を消す
  }
});

// ===== 7. 「＜」「＞」で月を切り替える =====
prevMonthButton.addEventListener("click", function () {
  changeMonth(-1);
});
nextMonthButton.addEventListener("click", function () {
  changeMonth(1);
});

// ===== 8. ページを開いたときの準備 =====
// 今日の日付を "2026-11-21" の形の文字にする
const now = new Date();
const today =
  now.getFullYear() + "-" +
  String(now.getMonth() + 1).padStart(2, "0") + "-" + // 月は0から数えるので +1
  String(now.getDate()).padStart(2, "0");              // 1桁なら前に0をつける

dateInput.value = today; // 日付の欄に今日を入れておく
showDate(today);         // 今月のカレンダーを表示して、今日を選ぶ

// ===== 9. サービスワーカー（オフラインで開けるようにする仕組み）を登録する =====
// インターネット上に公開したとき（http: や https: で開いたとき）だけ動く。
// PCのファイルを直接開いているとき（file:）は使えないので、何もしない。
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js");
}
