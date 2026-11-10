// Invitation / recovery landing: Supabase puts the session in the URL; the user picks a password.
import { db } from "./client-cf-v4.js";
const s = db(), form = document.getElementById("form"), err = document.getElementById("err"), btn = document.getElementById("btn");
const { data: { session } } = await s.auth.getSession();
if (!session) { err.textContent = "الرابط ده انتهى أو اتستخدم قبل كده. اطلب دعوة جديدة."; btn.disabled = true; }
else document.getElementById("who").textContent = `اختار كلمة سر لحساب ${session.user.email}.`;
form.onsubmit = async e => {
  e.preventDefault(); err.textContent = "";
  const a = document.getElementById("pw").value, b = document.getElementById("pw2").value;
  if (a.length < 12) return (err.textContent = "كلمة السر لازم تكون 12 حرف على الأقل");
  if (a !== b) return (err.textContent = "الكلمتين مش زي بعض");
  btn.disabled = true;
  const { error } = await s.auth.updateUser({ password: a });
  if (error) { err.textContent = error.message; btn.disabled = false; return; }
  location.replace("./dashboard.html");
};
