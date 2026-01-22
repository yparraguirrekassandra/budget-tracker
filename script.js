import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// authentication
onAuthStateChanged(auth, (user) => {
  if (user) {
    if (document.getElementById("type")) { 
      initializeDefaultCategories().then(() => {
        loadCategoriesFromFirebase().then(() => {
          updateCategoryOptions();
          loadTransactions();
        });
      });
    }
  } else {
    if (document.getElementById("logoutBtn")) {
      window.location.href = "login.html";
    }
  }
});

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

if (loginBtn) { 
  loginBtn.onclick = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "index.html";
    } catch (err) { alert(err.message); }
  };

  registerBtn.onclick = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Table 1: Users - Creating the parent document
      await addDoc(collection(db, "users"), {
        uid: userCredential.user.uid,
        email: email,
        createdDate: new Date(),
        name: email.split('@')[0]  
      });
      
      window.location.href = "index.html";
    } catch (err) { alert(err.message); }
  };
}

if (logoutBtn) { 
  logoutBtn.onclick = async () => {
    await signOut(auth);
    window.location.href = "login.html";
  };
}

// budget tracker 
let incomeCategories = [];
let expenseCategories = [];
let editingDocId = null;

window.updateCategoryOptions = updateCategoryOptions;
window.addCategory = addCategory;
window.saveTransaction = saveTransaction;
window.deleteCategory = deleteCategory;
window.cancelEdit = cancelEdit;
window.toggleCategories = toggleCategories;

async function initializeDefaultCategories() {
  const userPath = `users/${auth.currentUser.uid}/categories`; 
  const snapshot = await getDocs(collection(db, userPath));
  
  if (snapshot.empty) {
    const defaults = [
      { name: 'Work', type: 'Income' }, { name: 'Allowance', type: 'Income' },
      { name: 'Food', type: 'Expense' }, { name: 'Rent', type: 'Expense' }
    ];
    for (const cat of defaults) {
      await addDoc(collection(db, userPath), { categoryName: cat.name, type: cat.type });
    }
  }
}

async function loadCategoriesFromFirebase() {
  const snapshot = await getDocs(collection(db, `users/${auth.currentUser.uid}/categories`));
  incomeCategories = [];
  expenseCategories = [];
  snapshot.forEach(docSnap => {
    const cat = docSnap.data();
    if (cat.type === "Income") incomeCategories.push(cat.categoryName);
    else expenseCategories.push(cat.categoryName);
  });
}

function updateCategoryOptions() {
  const type = document.getElementById("type").value;
  const categories = type === "Income" ? incomeCategories : expenseCategories;
  populateSelect("category", categories);
  populateSelect("categoryToDelete", categories);
}

function populateSelect(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(i => `<option value="${i}">${i}</option>`).join("");
}

async function addCategory() {
  const name = document.getElementById("newCategory").value.trim();
  const type = document.getElementById("type").value;
  if (!name) return;
  
  await addDoc(collection(db, `users/${auth.currentUser.uid}/categories`), {
    categoryName: name, type: type
  });
  document.getElementById("newCategory").value = "";
  await loadCategoriesFromFirebase();
  updateCategoryOptions();
}

async function deleteCategory() {
  const name = document.getElementById("categoryToDelete").value;
  const type = document.getElementById("type").value;
  const snapshot = await getDocs(query(
    collection(db, `users/${auth.currentUser.uid}/categories`), 
    where("categoryName", "==", name), 
    where("type", "==", type)
  ));
  snapshot.forEach(d => deleteDoc(d.ref));
  await loadCategoriesFromFirebase();
  updateCategoryOptions();
}

async function saveTransaction() {
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;
  const amount = Number(document.getElementById("amount").value);
  if (amount <= 0) return;

  const path = `users/${auth.currentUser.uid}/transactions`; 
  
  if (editingDocId) {
    await updateDoc(doc(db, path, editingDocId), { type, category, amount });
    editingDocId = null;
  } else {
    await addDoc(collection(db, path), { type, category, amount, date: new Date() });
  }

  document.getElementById("amount").value = "";
  document.getElementById("cancelBtn").style.display = "none";
  loadTransactions();
}

async function loadTransactions() {
  const snapshot = await getDocs(collection(db, `users/${auth.currentUser.uid}/transactions`));
  const lists = { Income: document.getElementById("incomeList"), Expense: document.getElementById("expenseList") };
  lists.Income.innerHTML = ""; lists.Expense.innerHTML = "";
  let totals = { Income: 0, Expense: 0 };

  snapshot.forEach(docSnap => {
    const t = docSnap.data();
    const li = document.createElement("li");
    li.innerHTML = `${t.category} - ₱${t.amount} <button onclick="event.stopPropagation(); deleteTransaction('${docSnap.id}')">X</button>`;
    li.onclick = () => editTransaction(docSnap.id, t.type, t.category, t.amount);
    lists[t.type].appendChild(li);
    totals[t.type] += t.amount;
  });

  document.getElementById("income").textContent = totals.Income;
  document.getElementById("expense").textContent = totals.Expense;
  document.getElementById("balance").textContent = totals.Income - totals.Expense;
}

window.deleteTransaction = async (id) => {
  await deleteDoc(doc(db, `users/${auth.currentUser.uid}/transactions`, id));
  loadTransactions();
};

function editTransaction(id, type, cat, amt) {
  editingDocId = id;
  document.getElementById("type").value = type;
  updateCategoryOptions();
  document.getElementById("category").value = cat;
  document.getElementById("amount").value = amt;
  document.getElementById("cancelBtn").style.display = "inline-block";
}

function cancelEdit() {
  editingDocId = null;
  document.getElementById("amount").value = "";
  document.getElementById("cancelBtn").style.display = "none";
}

function toggleCategories() {
  const c = document.getElementById("categoryContainer");
  c.style.display = c.style.display === "none" ? "block" : "none";
}