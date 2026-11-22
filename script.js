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
const startDeleteButton = document.getElementById("start-delete");

// 分類の選択肢を、上の入力フォームからそのままコピーする
// （分類を増やすときは index.html の上のフォーム1か所だけ直せばよい）
editCategory.innerHTML = categoryInput.innerHTML;

// ===== 色の丸が付いた、自作のプルダウン =====
// ふつうのプルダウン（<select>）は、開いたときの一覧を iPhone やブラウザが描くので、
// 色の丸を付けられない。そこで <select> は隠して「値を入れておく場所」としてだけ使い、
// 見た目は自分で作ったボタンと一覧で出す。

// 分類の色の小さな丸を作る関数
function makeDot(category) {
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.backgroundColor = colorOf(category);
  return dot;
}

// <select> を、自作のプルダウンに置きかえる関数
// 戻り値は「見た目を今の値に合わせ直す関数」。プログラムで値を変えたあとに呼ぶ
function makeCategoryPicker(select) {
  select.hidden = true; // 元のプルダウンは隠す（値はここに入れ続ける）

  const picker = document.createElement("div");   // 全体の入れ物
  picker.className = "picker";
  const button = document.createElement("button"); // 閉じているときに見える欄
  button.type = "button";
  button.className = "picker-button";
  button.setAttribute("aria-expanded", "false");   // 読み上げ機能に「閉じている」と伝える
  const list = document.createElement("ul");       // 押すと開く一覧
  list.className = "picker-list";
  list.hidden = true;

  // 一覧を開く・閉じる関数（isOpen が true なら開く）
  function setOpen(isOpen) {
    list.hidden = !isOpen;
    button.setAttribute("aria-expanded", String(isOpen));
  }

  // 元のプルダウンの選択肢を1つずつ取り出して、一覧の行を作る
  const optionButtons = [];
  for (const option of select.options) {
    const item = document.createElement("li");
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "picker-option";
    optionButton.appendChild(makeDot(option.value));
    optionButton.append(option.value); // append = 文字を後ろに付け足す

    // 選んだら、隠したプルダウンに値を入れて、一覧を閉じる
    optionButton.addEventListener("click", function () {
      select.value = option.value;
      refresh();
      setOpen(false);
    });

    item.appendChild(optionButton);
    list.appendChild(item);
    optionButtons.push({ value: option.value, button: optionButton });
  }

  // 欄を押したら、一覧を開く（開いていたら閉じる）
  button.addEventListener("click", function () {
    setOpen(list.hidden);
  });

  // 一覧の外をタップしたら閉じる
  document.addEventListener("click", function (event) {
    if (!picker.contains(event.target)) setOpen(false);
  });

  // 見た目を、隠したプルダウンの今の値に合わせる関数
  function refresh() {
    button.textContent = ""; // いったん空にする
    button.appendChild(makeDot(select.value));
    button.append(select.value);
    // 一覧の中で、今選んでいる行に印（selected）を付ける
    for (const entry of optionButtons) {
      entry.button.classList.toggle("selected", entry.value === select.value);
    }
    setOpen(false);
  }

  picker.appendChild(button);
  picker.appendChild(list);
  select.after(picker); // 隠したプルダウンのすぐ後ろに置く
  refresh();
  return refresh;
}

// 入力フォームと詳細ダイアログの「分類」を、自作のプルダウンにする
const refreshCategoryPicker = makeCategoryPicker(categoryInput);
const refreshEditCategoryPicker = makeCategoryPicker(editCategory);

// 「どの出費を編集しているか」を覚えておく箱
let expenseToEdit = null;

// 削除ダイアログで「削除する」を押したときにやること（関数）を覚えておく箱
// 出費の削除と家計簿の削除で、同じダイアログを使い回すため
let deleteAction = null;

// ===== 2. 家計簿の一覧と、出費のデータを入れておく箱 =====
// 保存しておく場所（ブラウザの中）での名前
const STORAGE_KEY = "kakeibo-expenses";          // 出費（1冊目）
const BOOKS_KEY = "kakeibo-books";               // 家計簿の一覧
const CURRENT_BOOK_KEY = "kakeibo-current-book"; // 最後に開いていた家計簿

// 家計簿の一覧。1冊ずつ { id: 見分けるための記号, name: 名前 } で入っている
// まだ1冊もなければ（前の版から使っている人も）、今までのデータを1冊目「家計簿」にする
let books = JSON.parse(localStorage.getItem(BOOKS_KEY)) || [{ id: "default", name: "家計簿" }];

// 今開いている家計簿の id。保存されていない・もう無い家計簿なら1冊目にする
let currentBookId = localStorage.getItem(CURRENT_BOOK_KEY);
if (!books.some(function (book) { return book.id === currentBookId; })) {
  currentBookId = books[0].id;
}

// 家計簿ごとの、出費の保存場所の名前を返す関数
// 1冊目（default）は今までと同じ名前を使うので、前の版のデータがそのまま読める
function storageKeyOf(bookId) {
  return bookId === "default" ? STORAGE_KEY : STORAGE_KEY + "-" + bookId;
}

// 指定した家計簿の出費を読み込む。何もなければ空の配列 [] から始める
function loadExpenses(bookId) {
  return JSON.parse(localStorage.getItem(storageKeyOf(bookId))) || [];
}

// 今開いている家計簿の出費
let expenses = loadExpenses(currentBookId);

// ===== 3. データを保存する関数 =====
function save() {
  // 配列を文字に変換して（JSON.stringify）、今開いている家計簿の場所に保存する
  localStorage.setItem(storageKeyOf(currentBookId), JSON.stringify(expenses));
}

// 家計簿の一覧と、今開いている家計簿を保存する関数
function saveBooks() {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  localStorage.setItem(CURRENT_BOOK_KEY, currentBookId);
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

    // 出費の内容を表示する部分（日付は見出しにあるので、分類と金額とメモ）
    const text = document.createElement("div");
    text.className = "item-text";

    // 1行目：分類と金額
    const mainLine = document.createElement("div");
    mainLine.textContent = expense.category + "　" + formatYen(expense.amount) + "円";
    text.appendChild(mainLine);

    // 2行目：メモ（メモがあるときだけ）
    if (expense.memo) {
      const memoLine = document.createElement("div");
      memoLine.className = "item-memo";
      memoLine.textContent = expense.memo;
      text.appendChild(memoLine);
    }

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

    item.appendChild(text);         // <li> の中に内容を入れる
    item.appendChild(detailButton); // <li> の中に詳細ボタンを入れる
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
  showToast(describe(expense) + " を追加しました");

  // 次の入力に備えて、金額とメモの欄を空にする
  amountInput.value = "";
  memoInput.value = "";

  // レシートの読み取り結果も片付けて、次のレシートに備える
  receiptPreview.hidden = true;
  ocrStatus.hidden = true;
  ocrDetails.hidden = true;
  ocrDetails.open = false; // 「読み取った文字を見る」を閉じた状態に戻す
});

// ===== お知らせ（トースト） =====
const toast = document.getElementById("toast");
let toastTimer = null; // 「何秒後に消す」の予約を覚えておく箱

// 画面の下にお知らせを出して、2.5秒後に消す関数
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show"); // CSS の .toast.show で見えるようになる
  // 続けて出したときは、前の「消す予約」を取り消してから予約し直す
  clearTimeout(toastTimer);
  // setTimeout(やること, ミリ秒) = 指定した時間のあとに1回だけ動かす（2500ミリ秒 = 2.5秒）
  toastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 2500);
}

// 出費を「11月22日 食費 1,060円」のような短い文にする関数
function describe(expense) {
  const month = Number(expense.date.slice(5, 7));
  const day = Number(expense.date.slice(8, 10));
  return month + "月" + day + "日 " + expense.category + " " + formatYen(expense.amount) + "円";
}

// ===== 詳細・編集ダイアログ =====
// 覚えておいた出費の内容を、入力欄に入れる関数
function fillDetail() {
  editDate.value = expenseToEdit.date;
  editCategory.value = expenseToEdit.category;
  refreshEditCategoryPicker(); // 自作のプルダウンの見た目も合わせる
  editAmount.value = expenseToEdit.amount;
  editMemo.value = expenseToEdit.memo;
}

// 「見るだけ」と「編集中」を切り替える関数（isEditing が true なら編集中）
function setEditMode(isEditing) {
  editFields.disabled = !isEditing;  // 編集中だけ入力できるようにする
  viewButtons.hidden = isEditing;    // 編集中は「閉じる・編集する」を隠す
  startDeleteButton.hidden = isEditing; // 編集中は「この出費を削除」も隠す
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
  showToast(describe(expenseToEdit) + " に変更しました");

  expenseToEdit = null;
  detailDialog.close();
});

// 「この出費を削除」：詳細ダイアログを閉じて、削除の確認ダイアログを出す
startDeleteButton.addEventListener("click", function () {
  const target = expenseToEdit; // 消す候補
  expenseToEdit = null;
  detailDialog.close();
  // 「削除する」が押されたら、下の function の中身が動く
  askDelete("この出費を削除しますか？", describe(target), function () {
    const index = expenses.indexOf(target); // 何番目にあるか調べる
    if (index !== -1) {           // 見つかったときだけ（見つからないと -1 になる）
      expenses.splice(index, 1);  // その位置から1件取り除く
      save();                     // 保存する
      render();                   // 画面を描き直す
      showToast(describe(target) + " を削除しました");
    }
  });
});

// ===== 削除の確認ダイアログ =====
const deleteTitle = document.getElementById("delete-title");

// 削除の確認ダイアログを出す関数
// title = 見出し、message = 消すものの説明、action = 「削除する」を押したときにやること
function askDelete(title, message, action) {
  deleteTitle.textContent = title;
  deleteMessage.textContent = message;
  deleteAction = action;
  deleteDialog.showModal(); // 確認ダイアログを画面中央に出す
}

// 「キャンセル」：ダイアログを閉じるだけ
cancelDeleteButton.addEventListener("click", function () {
  deleteAction = null;
  deleteDialog.close();
});

// 「削除する」：覚えておいた「やること」を実行する
confirmDeleteButton.addEventListener("click", function () {
  if (deleteAction !== null) deleteAction();
  deleteAction = null;
  deleteDialog.close();
});

// ===== メニューと、家計簿の切り替え =====
const bookTitle = document.getElementById("book-title");
const menuButton = document.getElementById("menu-button");
const menuDialog = document.getElementById("menu-dialog");
const closeMenuButton = document.getElementById("close-menu");
const bookList = document.getElementById("book-list");
const addBookButton = document.getElementById("add-book");
const renameBookButton = document.getElementById("rename-book");
const deleteBookButton = document.getElementById("delete-book");
const bookDialog = document.getElementById("book-dialog");
const bookForm = document.getElementById("book-form");
const bookDialogTitle = document.getElementById("book-dialog-title");
const bookNameInput = document.getElementById("book-name");
const cancelBookButton = document.getElementById("cancel-book");

// 名前のダイアログを「追加」と「名前の変更」のどちらで開いたかを覚えておく箱
let bookDialogMode = "add";

// 今開いている家計簿（{ id, name }）を返す関数
// find = 条件に合う最初の1つを探す
function currentBook() {
  return books.find(function (book) { return book.id === currentBookId; });
}

// 見出しの名前と、メニューの家計簿の一覧を描き直す関数
function renderBooks() {
  bookTitle.textContent = currentBook().name;
  bookList.textContent = ""; // いったん空にする

  for (const book of books) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "book-item";
    button.textContent = book.name;
    // 今開いている家計簿には印（current）を付ける
    if (book.id === currentBookId) button.classList.add("current");

    // 押したら、その家計簿に切り替えてメニューを閉じる
    button.addEventListener("click", function () {
      menuDialog.close();
      if (book.id !== currentBookId) {
        switchBook(book.id);
        showToast("「" + book.name + "」に切り替えました");
      }
    });

    item.appendChild(button);
    bookList.appendChild(item);
  }

  // 家計簿が1冊しかないときは削除できないようにする（0冊になってしまうため）
  deleteBookButton.disabled = books.length === 1;
}

// 家計簿を切り替える関数
function switchBook(bookId) {
  currentBookId = bookId;
  expenses = loadExpenses(bookId); // その家計簿の出費を読み込む
  saveBooks();                     // 「最後に開いていた家計簿」を覚えておく
  renderBooks();
  render();                        // カレンダーなどを描き直す
}

// ☰ を押したら、メニューを開く
menuButton.addEventListener("click", function () {
  renderBooks();
  menuDialog.showModal();
});

// × を押したら、メニューを閉じる
closeMenuButton.addEventListener("click", function () {
  menuDialog.close();
});

// メニューの外側（暗いところ）を押しても閉じる
// （外側を押すと、ダイアログそのものが押されたことになるので見分けられる）
menuDialog.addEventListener("click", function (event) {
  if (event.target === menuDialog) menuDialog.close();
});

// 名前のダイアログを開く関数（mode は "add" か "rename"）
function openBookDialog(mode) {
  bookDialogMode = mode;
  if (mode === "add") {
    bookDialogTitle.textContent = "新しい家計簿";
    bookNameInput.value = "";
  } else {
    bookDialogTitle.textContent = "家計簿の名前を変更";
    bookNameInput.value = currentBook().name;
  }
  bookDialog.showModal();
}

// 「＋ 新しい家計簿」「名前を変更」
addBookButton.addEventListener("click", function () {
  openBookDialog("add");
});
renameBookButton.addEventListener("click", function () {
  openBookDialog("rename");
});

// 名前のダイアログの「キャンセル」
cancelBookButton.addEventListener("click", function () {
  bookDialog.close();
});

// 名前のダイアログの「保存する」
bookForm.addEventListener("submit", function (event) {
  event.preventDefault(); // ページのリセットを止める
  const name = bookNameInput.value.trim(); // trim = 前後のすき間を取る
  if (name === "") return; // すき間だけの名前は受け付けない

  if (bookDialogMode === "add") {
    // 新しい家計簿を作る。id は今の時刻の数字を使う（毎回ちがう数になる）
    const book = { id: "b" + Date.now(), name: name };
    books.push(book);
    switchBook(book.id); // 作った家計簿に切り替える（ここで一覧も保存される）
    showToast("「" + name + "」を作りました");
  } else {
    currentBook().name = name;
    saveBooks();
    renderBooks();
    showToast("名前を「" + name + "」に変更しました");
  }
  bookDialog.close();
  menuDialog.close();
});

// 「この家計簿を削除」
deleteBookButton.addEventListener("click", function () {
  const book = currentBook();
  menuDialog.close();
  askDelete(
    "この家計簿を削除しますか？",
    "「" + book.name + "」と、その中の出費 " + expenses.length + "件 をすべて削除します。元には戻せません。",
    function () {
      localStorage.removeItem(storageKeyOf(book.id)); // 出費のデータを消す
      // filter = 条件に合うものだけ残す（消す家計簿以外を残す）
      books = books.filter(function (b) { return b.id !== book.id; });
      switchBook(books[0].id); // 残っている最初の家計簿に切り替える
      showToast("「" + book.name + "」を削除しました");
    }
  );
});

renderBooks(); // 最初に、見出しの名前を今の家計簿にしておく

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
    // 文字の形をそろえる（NFKC という決まりに合わせる）
    // 全角の数字「１２３」→ 半角「123」、半角カタカナ「ﾊﾟﾝ」→ 全角「パン」、「／」→「/」など
    .normalize("NFKC")
    .replace(/[、]/g, ",")
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
// 見つかったら { amount: 金額, from: どこから取ったか } を返す。見つからなければ null
function findTotal(lines) {
  // 上から順に試す言葉のグループ。前のグループで見つかれば、そこで終わる
  // （「合計」は太字で大きく印刷されて読み間違えやすいので、予備の探し方も用意しておく）
  const keywordGroups = [
    { from: "合計の行", keywords: ["合計", "お買上", "お買い上げ", "ご請求", "お会計"] },
    { from: "支払いの行", keywords: ["払い", "支払"] }, // d払い・PayPay払い・お支払 など
    { from: "小計の行", keywords: ["小計"] },           // 値引きがなければ合計と同じ
  ];
  for (const group of keywordGroups) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 言葉が1つも入っていない行は飛ばす（some = 「どれか1つでも当てはまるか」）
      if (!group.keywords.some(function (keyword) { return line.includes(keyword); })) continue;
      // 小計の行は、小計を探しているとき以外は飛ばす
      if (group.from !== "小計の行" && line.includes("小計")) continue;
      // その行に数があればそれ。なければ金額が次の行にあることも多いので、次の行を見る
      const amount = findAmountInLine(line) || findAmountInLine(lines[i + 1] || "");
      if (amount !== null) return { amount: amount, from: group.from };
    }
  }
  // ④ それでもなければ、「\1,234」のように円マークが付いた金額で、いちばん多く出てくるもの
  //    （合計は「合計」「対象額」「支払い」など、レシートに何度も出てくることが多い）
  return findMostCommonAmount(lines);
}

// 円マーク付きの金額を数えて、いちばん多く出てくる金額を返す関数
function findMostCommonAmount(lines) {
  const counts = {}; // 「金額 → 出てきた回数」を覚えておく箱
  for (const line of lines) {
    // お預り・お釣りの金額は合計ではないので数えない
    if (line.includes("預") || line.includes("釣")) continue;
    // 円マークは「\」や「¥」と読まれる。そのあとに続く数を全部取り出す
    const matches = line.match(/[\\¥￥]\d[\d,]*/g) || [];
    for (const match of matches) {
      const amount = Number(match.slice(1).replace(/,/g, ""));
      if (amount > 0) counts[amount] = (counts[amount] || 0) + 1;
    }
  }
  let best = null;
  for (const key of Object.keys(counts)) {
    const amount = Number(key);
    // 回数が多いほうを選ぶ。同じ回数なら金額が大きいほう（合計は個々の品物より大きい）
    if (best === null || counts[key] > counts[best] || (counts[key] === counts[best] && amount > best)) {
      best = amount;
    }
  }
  // 2回以上出てきた金額だけ信用する（1回だけだと品物1つの値段かもしれない）
  if (best === null || counts[best] < 2) return null;
  return { amount: best, from: "いちばん多く出てきた金額" };
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

// ===== 品物の名前から分類を決める =====
// 分類ごとの「よく出てくる言葉」の一覧。言葉はここに足していけば賢くなる
// ※「水」「本」のような1文字の言葉は「水曜」「日本」にも当てはまってしまうので入れない
// ※「レジ袋」はどの店のレシートにも出てくるので入れない
const CATEGORY_KEYWORDS = {
  "食費": [
    "スーパー", "食品", "牛乳", "パン", "たまご", "玉子", "卵", "米", "肉", "豚", "鶏", "魚",
    "刺身", "野菜", "キャベツ", "レタス", "玉ねぎ", "たまねぎ", "にんじん", "じゃがいも",
    "トマト", "きゅうり", "りんご", "バナナ", "みかん", "豆腐", "納豆", "ヨーグルト",
    "チーズ", "バター", "ハム", "ソーセージ", "弁当", "おにぎり", "惣菜", "総菜", "ジュース",
    "お茶", "緑茶", "コーヒー", "菓子", "チョコ", "アイス", "麺", "冷凍", "調味料", "醤油",
    "しょうゆ", "味噌", "みそ",
  ],
  "日用品": [
    "ドラッグ", "薬局", "ホームセンター", "ティッシュ", "トイレット", "洗剤", "柔軟剤",
    "漂白", "シャンプー", "リンス", "コンディショナー", "ボディソープ", "ハンドソープ",
    "石鹸", "せっけん", "歯ブラシ", "歯磨", "ハミガキ", "ゴミ袋", "ごみ袋", "ラップ",
    "アルミホイル", "スポンジ", "電池", "マスク", "綿棒", "絆創膏", "化粧", "日用品",
  ],
  "交通費": [
    "乗車", "切符", "きっぷ", "定期券", "運賃", "電車", "鉄道", "タクシー", "駐車",
    "ガソリン", "レギュラー", "ハイオク", "軽油", "高速", "ETC",
  ],
  "趣味・娯楽": [
    "書籍", "書店", "文庫", "雑誌", "コミック", "ゲーム", "映画", "チケット", "入場",
    "スポーツ", "DVD", "おもちゃ", "玩具", "カラオケ", "プラモ",
  ],
  "外食": [
    "店内", "イートイン", "テイクアウト", "持ち帰り", "お持帰り", "ランチ", "ディナー",
    "定食", "ラーメン", "うどん", "そば", "丼", "カレー", "寿司", "焼肉", "餃子",
    "居酒屋", "生ビール", "レストラン", "カフェ", "食堂", "飲食", "お通し", "名様",
  ],
};

// レシートの行から分類を決める関数
// 見つかったら { category: 分類, words: 当てはまった言葉の配列 } を返す。1つもなければ null
function guessCategory(lines) {
  const text = lines.join("\n"); // 全部の行を1つの文字にまとめる
  let best = null;
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    // この分類の言葉のうち、レシートに入っているものだけを取り出す（filter = 条件に合うものだけ残す）
    const words = CATEGORY_KEYWORDS[category].filter(function (word) {
      return text.includes(word);
    });
    // 当てはまった言葉がいちばん多い分類を覚えておく
    if (words.length > 0 && (best === null || words.length > best.words.length)) {
      best = { category: category, words: words };
    }
  }
  return best;
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
    const guess = guessCategory(lines);

    // 見つかったものを入力フォームに入れる
    if (total !== null) amountInput.value = total.amount;
    if (date !== null) dateInput.value = date;
    if (guess !== null) {
      categoryInput.value = guess.category;
      refreshCategoryPicker(); // 自作のプルダウンの見た目も合わせる
    }

    // 結果のお知らせ。最後は自分で確かめて「追加する」を押してもらう
    if (total !== null) {
      // 例: 「金額 29,271円・日付 11月21日 を読み取りました」
      let message = "金額 " + formatYen(total.amount) + "円";
      if (date !== null) {
        message += "・日付 " + Number(date.slice(5, 7)) + "月" + Number(date.slice(8, 10)) + "日";
      }
      message += " を読み取りました。";
      // 合計の行以外から取ったときは、どこから取ったかを知らせる
      if (total.from !== "合計の行") {
        message += "（合計の行がうまく読めなかったので、" + total.from + "から取りました）";
      }
      if (date === null) message += "日付は見つからなかったので、確かめてください。";
      // 分類のお知らせ。例: 「分類は「食費」にしました（牛乳・パン などから）」
      if (guess !== null) {
        // slice(0, 3) = 最初の3つだけ。join("・") = 「・」でつなぐ
        message += "分類は「" + guess.category + "」にしました（" + guess.words.slice(0, 3).join("・") + " などから）。";
      } else {
        message += "分類はわからなかったので、選んでください。";
      }
      ocrStatus.textContent = message + "合っていたら「追加する」を押してください。";
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
