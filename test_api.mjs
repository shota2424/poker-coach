const key = 'AIzaSyBsZh7xrEixS13cRje_yBwwsZO30wfwC50';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
fetch(url).then(res => res.json()).then(data => {
  if (data.error) {
    console.error("API Response Error:", data.error.message);
  } else {
    console.log("Success! Models:", data.models.filter(m => m.name.includes("gemini")).map(m => m.name).join(', '));
  }
}).catch(e => console.error("Network Error:", e));
