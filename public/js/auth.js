// --- Signup ---
async function signupUser(e) {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, confirmPassword }),
  });

  const data = await res.json();

  if (res.ok) {
    // Save user to localStorage
    const user = { name, email, photoURL: "" }; 
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", data.token || "");
    window.location.href = "subject.html";
  } else {
    alert(data.error || "Signup failed");
  }
}

// --- Login ---
async function loginUser(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (res.ok) {
    const user = {
      name: data.user?.name || "User",
      email: data.user?.email || email,
      photoURL: data.user?.photoURL || ""
    };
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", data.token);
    window.location.href = "subject.html";
  } else {
    alert(data.error || "Login failed");
  }
}

// --- Auth Check ---
function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) window.location.href = "login.html";
}
