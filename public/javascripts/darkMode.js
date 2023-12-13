function getSystemColorScheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function saveUserPreference(preference) {
  localStorage.setItem('color-scheme', preference);
}
 
function loadUserPreference() {
  return localStorage.getItem('color-scheme');
}

function toggleDarkMode(enableDarkMode) {
  document.documentElement.classList.toggle("dark-mode", enableDarkMode);
  if (enableDarkMode) {
    document.getElementById('toggle-darkmode-moon-icon').style.display = 'none';
    document.getElementById('toggle-darkmode-sun-icon').style.display = 'block';
  } else {
    document.getElementById('toggle-darkmode-moon-icon').style.display = 'block';
    document.getElementById('toggle-darkmode-sun-icon').style.display = 'none';
  }
}

function toggleElementVisibility(element) {
  if (element.style.display === "none") {
    element.style.display = "block";
  } else {
    element.style.display = "none";
  }
}

function initializeDarkMode() {
  const userPreference = loadUserPreference();
 
  if (userPreference) {
    toggleDarkMode(userPreference === 'dark');
  } else {
    const systemColorScheme = getSystemColorScheme();
    toggleDarkMode(systemColorScheme === 'dark');
  }
}

function handleDarkModeToggle() {
  const currentPreference = loadUserPreference() || getSystemColorScheme();
  const newPreference = currentPreference === 'dark' ? 'light' : 'dark';
 
  toggleDarkMode(newPreference === 'dark');
  saveUserPreference(newPreference);
}


function handleSystemColorSchemeChange(event) {
  if (!loadUserPreference()) {
    toggleDarkMode(event.matches);
  }
}

function onDOMContentLoaded() {
  initializeDarkMode();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemColorSchemeChange);
  document.getElementById('toggle-darkmode').addEventListener('click', handleDarkModeToggle);
}
 
document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
