const sidebar = document.getElementById('sidebar');
const openMenu = document.getElementById('openMenu');
const closeMenu = document.getElementById('closeMenu');

openMenu.addEventListener('click', () => {
  sidebar.classList.add('active');
  openMenu.style.display = 'none';
});

closeMenu.addEventListener('click', () => {
  sidebar.classList.remove('active');
  openMenu.style.display = 'block';
});

function showTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  sidebar.classList.remove('active');
  openMenu.style.display = 'block';
}
