const price = new URLSearchParams(location.search).get("price");
if (price) document.getElementById("price").innerHTML = `تبدأ من <b>${price} ج.م</b>`;
window.seek = ms => document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; });
