const SITE_URL = "https://aminut-il.vercel.app";

const textArea = document.getElementById("claim-text");
const checkButton = document.getElementById("check-button");
const openSiteLink = document.getElementById("open-site-link");

openSiteLink.href = SITE_URL;

checkButton.addEventListener("click", () => {
  const text = textArea.value.trim();
  const url = new URL(SITE_URL);
  if (text) url.searchParams.set("text", text);
  chrome.tabs.create({ url: url.toString() });
  window.close();
});
