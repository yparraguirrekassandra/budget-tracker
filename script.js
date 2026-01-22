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

//authenitcation
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
      await createUserWithEmailAndPassword(auth, email, password);
      window.location.href = "index.html";
    } catch (err) { alert(err.message); }
  };

  onAuthStateChanged(auth, user => {
    if (user) window.location.href = "index.html";
  });
}

if (logoutBtn) { 
  logoutBtn.onclick = async () => {
    await signOut(auth);
    window.location.href = "login.html";
  };
}

//budget tracker
let incomeCategories = [];
let expenseCategories = [];
let editingDocId = null;

window.updateCategoryOptions = updateCategoryOptions;
window.addCategory = addCategory;
window.saveTransaction = saveTransaction;
window.deleteCategory = deleteCategory;
window.cancelEdit = cancelEdit;
window.toggleCategories = toggleCategories;

onAuthStateChanged(auth, async (user) => {
  if (document.getElementById("type")) { 
    if (user) {
      await initializeDefaultCategories();
      await loadCategoriesFromFirebase();
      updateCategoryOptions();
      loadTransactions();
    }
  }
});

function populateCategorySelect(selectId, categories) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = "";
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}

async function loadCategoriesFromFirebase() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "categories"), where("uid", "==", auth.currentUser.uid))
    );
    
    incomeCategories = [];
    expenseCategories = [];
    
    snapshot.forEach(docSnap => {
      const cat = docSnap.data();
      if (cat.type === "Income") {
        incomeCategories.push(cat.categoryName);
      } else {
        expenseCategories.push(cat.categoryName);
      }
    });
  } catch (err) {
    console.log("Error loading categories:", err);
  }
}

async function initializeDefaultCategories() {
  const defaultIncomeCategories = ['Work', 'Allowance', 'Freelance', 'Other'];
  const defaultExpenseCategories = ['Food', 'Transportation', 'Rent', 'Tuition', 'Savings', 'Entertainment', 'Utilities', 'Other'];
  
  const snapshot = await getDocs(
    query(collection(db, "categories"), where("uid", "==", auth.currentUser.uid))
  );
  
  if (snapshot.empty) {
    for (const cat of defaultIncomeCategories) {
      await addDoc(collection(db, "categories"), {
        uid: auth.currentUser.uid,
        categoryName: cat,
        type: "Income"
      });
    }
    
    for (const cat of defaultExpenseCategories) {
      await addDoc(collection(db, "categories"), {
        uid: auth.currentUser.uid,
        categoryName: cat,
        type: "Expense"
      });
    }
  }
}

function updateCategoryOptions() {
  const type = document.getElementById("type").value;
  const categories = type === "Income" ? incomeCategories : expenseCategories;
  populateCategorySelect("category", categories);
  populateCategorySelect("categoryToDelete", categories);
}

function addCategory() {
  const newCategory = document.getElementById("newCategory").value.trim();
  const type = document.getElementById("type").value;
  if (!newCategory) return alert("Enter a category name");
  
  const categories = type === "Income" ? incomeCategories : expenseCategories;
  if (categories.includes(newCategory)) return alert("Category already exists");
  
  addDoc(collection(db, "categories"), {
    uid: auth.currentUser.uid,
    categoryName: newCategory,
    type: type
  });
  
  document.getElementById("newCategory").value = "";
  loadCategoriesFromFirebase().then(() => updateCategoryOptions());
}

function deleteCategory() {
  const categoryToDelete = document.getElementById("categoryToDelete").value;
  const type = document.getElementById("type").value;
  if (!categoryToDelete) return alert("Select a category to delete");
  
  (async () => {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "categories"),
          where("uid", "==", auth.currentUser.uid),
          where("categoryName", "==", categoryToDelete),
          where("type", "==", type)
        )
      );
      
      snapshot.forEach(docSnap => {
        deleteDoc(docSnap.ref);
      });
      
      loadCategoriesFromFirebase().then(() => updateCategoryOptions());
    } catch (err) {
      console.log("Error deleting category:", err);
    }
  })();
}

async function saveTransaction() {
  const type = document.getElementById("type").value;
  const category = document.getElementById("category").value;
  const amount = Number(document.getElementById("amount").value);
  
  if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount");

  if (editingDocId) {
    await updateDoc(doc(db, "transactions", editingDocId), {
      type, category, amount
    });
    editingDocId = null;
  } else {
    await addDoc(collection(db, "transactions"), {
      uid: auth.currentUser.uid,
      type, category, amount
    });
  }

  document.getElementById("amount").value = "";
  document.getElementById("cancelBtn").style.display = "none";
  loadTransactions();
}

async function loadTransactions() {
  const incomeList = document.getElementById("incomeList");
  const expenseList = document.getElementById("expenseList");
  incomeList.innerHTML = "";
  expenseList.innerHTML = "";

  let income = 0, expense = 0;

  const snapshot = await getDocs(
    query(collection(db, "transactions"), where("uid","==",auth.currentUser.uid))
  );
  
  snapshot.forEach(docSnap => {
    const t = docSnap.data();
    const docId = docSnap.id;
    const li = document.createElement("li");
    li.textContent = `${t.category} - ₱${t.amount}`;
    li.style.cursor = "pointer";
    li.onclick = () => editTransaction(docId, t.type, t.category, t.amount);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteTransaction(docId);
    };
    li.appendChild(deleteBtn);

    if (t.type === "Income") {
      income += t.amount;
      incomeList.appendChild(li);
    } else {
      expense += t.amount;
      expenseList.appendChild(li);
    }
  });

  document.getElementById("income").textContent = income;
  document.getElementById("expense").textContent = expense;
  document.getElementById("balance").textContent = income - expense;
}

function editTransaction(docId, type, category, amount) {
  editingDocId = docId;
  document.getElementById("type").value = type;
  updateCategoryOptions();
  document.getElementById("category").value = category;
  document.getElementById("amount").value = amount;
  document.getElementById("cancelBtn").style.display = "inline-block";
}

function cancelEdit() {
  editingDocId = null;
  document.getElementById("amount").value = "";
  document.getElementById("cancelBtn").style.display = "none";
}

function toggleCategories() {
  const container = document.getElementById("categoryContainer");
  container.style.display = container.style.display === "none" ? "block" : "none";
}

async function deleteTransaction(docId) {
  await deleteDoc(doc(db, "transactions", docId));
  loadTransactions();
}
