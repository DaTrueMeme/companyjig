// Nav

fetch("/components/nav.html")
    .then(res => res.text())
    .then(data => {
        document.getElementById("nav-container").innerHTML = data;
    });

function showSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'flex';
}

function hideSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'none';
}

// Footer

fetch("/components/footer.html")
    .then(res => res.text())
    .then(data => {
        document.getElementById("footer-container").innerHTML = data;
    });