// js/ai-api.js
// Общий помощник для вызова OpenAI API.
// Ключ берётся из sessionStorage.OPENAI_KEY (тот же, что и на странице перевода).

(function(){
  const PROXY_URL = ""; // при желании можно указать backend-прокси

  function getKey(){
    return sessionStorage.getItem("OPENAI_KEY") || "";
  }

  async function chat(messages, opts){
    const key = getKey();
    if(!key && !PROXY_URL){
      throw new Error("OpenAI API key не задан. Задайте его на странице «Перевод резюме».");
    }

    const body = {
      model: (opts && opts.model) || "gpt-4o-mini",
      messages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 800
    };

    const url = PROXY_URL
      ? PROXY_URL + "?path=" + encodeURIComponent("/v1/chat/completions")
      : "https://api.openai.com/v1/chat/completions";

    const headers = {
      "Content-Type": "application/json",
      ...(PROXY_URL ? {} : {"Authorization": "Bearer " + key})
    };

    const resp = await fetch(url, {
      method:"POST",
      headers,
      body: JSON.stringify(body)
    });

    if(!resp.ok){
      const text = await resp.text();
      throw new Error("OpenAI error " + resp.status + ": " + text);
    }

    const json = await resp.json();
    return json.choices?.[0]?.message?.content || "";
  }

  window.aiApi = { chat, getKey };
})();
