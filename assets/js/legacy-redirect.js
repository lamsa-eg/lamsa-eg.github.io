// Old order page (v19) moved to /order — keep ?package= and other params.
location.replace("/order" + location.search + location.hash);
