// ===== PC と iPhone の同期（Firebase） =====
// このファイルは「同期の係」。script.js（家計簿の本体）のあとに動く。
//
// しくみ：
//  ・script.js がデータを保存すると「保存したよ」の合図（イベント）を出す
//    → ここでその合図を聞いて、Firebase（ネット上のデータ置き場）にも送る
//  ・ほかの機械が Firebase のデータを変えると、ここに知らせが届く
//    → 受け取ったデータで、この機械のデータを置きかえて、画面を描き直す
//
// Firebase のデータの置き方：
//   users / （ログインした人の番号） / books / （家計簿の id）
//     → { name: 名前, order: 並び順, expenses: [出費, …], updatedAt: 保存した時刻 }

// Firebase のプロジェクトの「住所」。パスワードではないので、公開しても大丈夫
// （データは Firebase の「ルール」で、本人しか読み書きできないように守っている）
const firebaseConfig = {
  apiKey: "AIzaSyAqTbNbC_tEyAWxxzUFgTTK4IiB4vE9g58",
  authDomain: "kakeibo-99608.firebaseapp.com",
  projectId: "kakeibo-99608",
  storageBucket: "kakeibo-99608.firebasestorage.app",
  messagingSenderId: "783392599707",
  appId: "1:783392599707:web:184a69e465a81e3d9c203e",
};

// この機械が、どの人のデータとつながっているか（ログインした人の番号）を覚えておく場所の名前
const SYNC_UID_KEY = "kakeibo-sync-uid";

// ===== 画面の部品 =====
const syncLoggedOut = document.getElementById("sync-logged-out");
const syncLoggedIn = document.getElementById("sync-logged-in");
const syncStatus = document.getElementById("sync-status");
const openLoginButton = document.getElementById("open-login");
const logoutButton = document.getElementById("logout");
const loginDialog = document.getElementById("login-dialog");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");
const signupSubmit = document.getElementById("signup-submit");
const resetPasswordButton = document.getElementById("reset-password");
const cancelLoginButton = document.getElementById("cancel-login");

// Firebase の部品が読み込めたときだけ、同期を動かす
// （ネットにつながっていないなどで読み込めなければ、今までどおり機械の中のデータだけで使う）
if (typeof firebase === "undefined") {
  openLoginButton.addEventListener("click", function () {
    showToast("同期の仕組みを読み込めませんでした。ネットにつながっているか確かめてください。");
  });
} else {
  startSync();
}

function startSync() {
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();     // ログインの係
  const db = firebase.firestore();  // データ置き場（Firestore）の係
  auth.languageCode = "ja";         // パスワード再設定のメールを日本語にする

  // ネットが切れているあいだに送ったデータを、アプリを閉じても忘れないようにする
  db.enablePersistence({ synchronizeTabs: true }).catch(function () {
    // 使えないブラウザもある。そのときは、開いているあいだだけ覚えておく
  });

  let uid = null;          // ログインしている人の番号（していなければ null）
  let stopListening = null; // 「ほかの機械からの知らせ」の受け取りをやめる関数
  let ready = false;       // 最初の合わせ込みが終わったか（終わるまでは送らない）

  // この人の家計簿が入っている場所（コレクション）
  function booksCollection() {
    return db.collection("users").doc(uid).collection("books");
  }

  // 家計簿1冊を、Firebase に送るデータの形にする関数
  function toCloudData(book, index) {
    return {
      name: book.name,
      order: index,                  // 並び順
      expenses: loadExpenses(book.id),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(), // Firebase 側の時刻
    };
  }

  // 家計簿1冊だけを送る（出費を追加・編集・削除したとき）
  function uploadBook(bookId) {
    const index = books.findIndex(function (book) { return book.id === bookId; });
    if (index === -1) return Promise.resolve();
    return booksCollection().doc(bookId).set(toCloudData(books[index], index));
  }

  // 全部の家計簿を送る（家計簿の追加・名前の変更・削除、バックアップから戻したとき）
  async function uploadAll() {
    // 先に Firebase の今の中身を読む（少し時間がかかる）
    const snapshot = await booksCollection().get();
    // 送るデータは、読み終わったあと（送る直前）に作る。
    // 待っているあいだに出費が追加されても、最新のデータを送れるように
    // batch = いくつもの書きこみを、まとめて1回で送る
    const batch = db.batch();
    books.forEach(function (book, index) {
      batch.set(booksCollection().doc(book.id), toCloudData(book, index));
    });
    // この機械で消した家計簿は、Firebase からも消す
    snapshot.forEach(function (doc) {
      const stillExists = books.some(function (book) { return book.id === doc.id; });
      if (!stillExists) batch.delete(doc.ref);
    });
    await batch.commit();
  }

  // Firebase から受け取ったデータで、この機械のデータを置きかえる
  function applySnapshot(snapshot) {
    const remoteBooks = snapshot.docs.map(function (doc) {
      const data = doc.data();
      return { id: doc.id, name: data.name, order: data.order, expenses: data.expenses || [] };
    });
    if (remoteBooks.length === 0) return;
    // 並び順のとおりに並べる
    remoteBooks.sort(function (a, b) { return a.order - b.order; });
    // 今開いている家計簿はそのまま。false = 受け取ったデータを送り返さない
    replaceAllData(remoteBooks, currentBookId, false);
  }

  // ほかの機械からの知らせを受け取り始める
  function startListening() {
    // onSnapshot = Firebase のデータが変わるたびに、中の関数を呼んでくれる
    stopListening = booksCollection().onSnapshot(function (snapshot) {
      // 自分が送ったばかりの変更は、もう画面に出ているので何もしない
      if (snapshot.metadata.hasPendingWrites) return;
      applySnapshot(snapshot);
    }, showSyncError);
  }

  // この機械のデータとつなげて、同期を始める
  function finishLinking() {
    localStorage.setItem(SYNC_UID_KEY, uid);
    ready = true;
    startListening();
    renderSyncStatus();
  }

  // この機械に、出費か2冊目以降の家計簿があるか
  function hasLocalData() {
    return books.length > 1 || books.some(function (book) { return loadExpenses(book.id).length > 0; });
  }

  // ===== ログインの状態が変わったとき（アプリを開いたとき・ログイン・ログアウト） =====
  auth.onAuthStateChanged(async function (user) {
    // 前の人の知らせの受け取りをやめる
    if (stopListening !== null) {
      stopListening();
      stopListening = null;
    }
    ready = false;
    uid = user ? user.uid : null;
    renderSyncStatus();
    if (user === null) return; // ログインしていない

    try {
      const snapshot = await booksCollection().get();

      if (snapshot.empty) {
        // Firebase がまだ空（はじめてログインした機械）→ この機械のデータを送る（引っ越し）
        await uploadAll();
        finishLinking();
        showToast("この機械のデータを Firebase に保存しました。これからは自動でそろいます");
      } else if (localStorage.getItem(SYNC_UID_KEY) === uid || !hasLocalData()) {
        // 前にもこの人でつながっていた、またはこの機械にデータがない → Firebase のデータを使う
        applySnapshot(snapshot);
        finishLinking();
      } else {
        // この機械にもデータがある（2台目の機械）→ 置きかえてよいか確かめる
        let count = 0;
        snapshot.forEach(function (doc) { count = count + (doc.data().expenses || []).length; });
        askDelete(
          "Firebase のデータを使いますか？",
          "この機械のデータを、Firebase に保存されているデータ（家計簿 " + snapshot.size + "冊・出費 " + count + "件）で置きかえます。" +
            "この機械にしかないデータは消えます。残したいときは「キャンセル」を押して、先にバックアップを保存してください。",
          function () {
            applySnapshot(snapshot);
            finishLinking();
            showToast("Firebase のデータに置きかえました。これからは自動でそろいます");
          },
          "置きかえる",
          function () {
            auth.signOut(); // 置きかえないなら、ログインをやめる
            showToast("ログインをやめました。この機械のデータはそのままです");
          }
        );
      }
    } catch (error) {
      showSyncError(error);
    }
  });

  // ===== script.js からの「保存したよ」の合図を聞いて、Firebase に送る =====
  document.addEventListener("kakeibo-book-saved", function (event) {
    if (ready) uploadBook(event.detail.bookId).catch(showSyncError);
  });
  document.addEventListener("kakeibo-books-saved", function () {
    if (ready) uploadAll().catch(showSyncError);
  });

  // ===== メニューの表示 =====
  function renderSyncStatus() {
    const user = auth.currentUser;
    syncLoggedOut.hidden = user !== null;
    syncLoggedIn.hidden = user === null;
    if (user === null) return;
    let state;
    if (!ready) state = "準備中…";
    else if (!navigator.onLine) state = "オフライン（つながったら送ります）";
    else state = "自動で同期しています ✓";
    syncStatus.textContent = user.email + "\n" + state;
  }
  // ネットがつながった・切れたときも、表示を新しくする
  window.addEventListener("online", renderSyncStatus);
  window.addEventListener("offline", renderSyncStatus);

  // ===== ログインのダイアログ =====
  openLoginButton.addEventListener("click", function () {
    menuDialog.close();
    loginError.hidden = true;
    loginDialog.showModal();
  });

  cancelLoginButton.addEventListener("click", function () {
    loginDialog.close();
  });

  // ボタンを押せる・押せないを切り替える（待っているあいだに2回押されないように）
  function setLoginBusy(isBusy) {
    loginSubmit.disabled = isBusy;
    signupSubmit.disabled = isBusy;
    resetPasswordButton.disabled = isBusy;
  }

  // うまくいかなかった理由を、ダイアログの中に出す
  function showLoginError(error) {
    loginError.textContent = authErrorMessage(error);
    loginError.hidden = false;
  }

  // 「ログイン」
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setLoginBusy(true);
    try {
      await auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value);
      loginDialog.close();
      loginPassword.value = "";
      showToast("ログインしました");
    } catch (error) {
      showLoginError(error);
    }
    setLoginBusy(false);
  });

  // 「この内容で新しく登録」
  signupSubmit.addEventListener("click", async function () {
    // reportValidity = 入力欄のきまり（メールの形・6文字以上）を確かめて、ダメなら知らせる
    if (!loginForm.reportValidity()) return;
    setLoginBusy(true);
    try {
      await auth.createUserWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value);
      loginDialog.close();
      loginPassword.value = "";
      showToast("登録してログインしました");
    } catch (error) {
      showLoginError(error);
    }
    setLoginBusy(false);
  });

  // 「パスワードを忘れたとき」：パスワードを決め直すメールを送る
  resetPasswordButton.addEventListener("click", async function () {
    const email = loginEmail.value.trim();
    if (email === "") {
      loginError.textContent = "メールアドレスを入れてから押してください";
      loginError.hidden = false;
      return;
    }
    setLoginBusy(true);
    try {
      await auth.sendPasswordResetEmail(email);
      loginError.hidden = true;
      showToast("パスワードを決め直すメールを送りました");
    } catch (error) {
      showLoginError(error);
    }
    setLoginBusy(false);
  });

  // 「ログアウト」
  logoutButton.addEventListener("click", function () {
    auth.signOut();
    // つながりの印を消しておく。次にログインしたとき、この機械のデータを置きかえる前に確かめるため
    localStorage.removeItem(SYNC_UID_KEY);
    menuDialog.close();
    showToast("ログアウトしました（この機械のデータは残っています）");
  });
}

// ===== うまくいかなかったときの説明 =====
// Firebase のエラーの記号（code）を、わかりやすい日本語にする
function authErrorMessage(error) {
  const messages = {
    "auth/invalid-credential": "メールアドレスかパスワードがちがいます",
    "auth/wrong-password": "メールアドレスかパスワードがちがいます",
    "auth/user-not-found": "メールアドレスかパスワードがちがいます",
    "auth/invalid-email": "メールアドレスの形がちがいます",
    "auth/email-already-in-use": "このメールアドレスはもう登録されています。「ログイン」を押してください",
    "auth/weak-password": "パスワードは6文字以上にしてください",
    "auth/too-many-requests": "何度も失敗したので、しばらく待ってから試してください",
    "auth/network-request-failed": "ネットにつながっていないようです",
    "auth/operation-not-allowed": "Firebase で「メール / パスワード」のログインがオンになっていないようです",
  };
  return messages[error.code] || "うまくいきませんでした（" + error.code + "）";
}

// 同期でうまくいかなかったときのお知らせ
function showSyncError(error) {
  console.error(error); // くわしい原因は開発者ツールに出す
  if (error.code === "permission-denied") {
    showToast("同期できませんでした。Firebase のルールの設定を確かめてください");
  } else {
    showToast("同期できませんでした（" + (error.code || error.message) + "）");
  }
}
