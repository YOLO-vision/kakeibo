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
