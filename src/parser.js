// Logic parse kết quả từ WebSocket binary frame
// Inject vào browser qua Playwright

const INJECT_SCRIPT = `
(() => {
  if (window.__taixiu_hooked) return;
  window.__taixiu_hooked = true;

  const O = window.WebSocket;
  window.__taixiu_results = [];

  function readVarint(bytes, idx) {
    let result = 0, shift = 0, i = idx;
    while (i < bytes.length && shift <= 28) {
      const b = bytes[i];
      result |= (b & 0x7f) << shift;
      i++;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return { value: result >>> 0, nextIdx: i };
  }

  function toLooseAscii(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      s += b >= 32 && b < 127 ? String.fromCharCode(b) : " ";
    }
    return s;
  }

  window.WebSocket = function (url, protocols) {
    console.log('[INJECT] WS connect:', url);
    const ws = protocols ? new O(url, protocols) : new O(url);

    ws.addEventListener("message", (e) => {
      try {
        if (!(e.data instanceof ArrayBuffer)) return;
        const bytes = new Uint8Array(e.data);
        const ascii = toLooseAscii(bytes);
        if (!ascii.includes("mnmdsbgameend")) return;

        console.log('[INJECT] gameend detected!');

        const m = ascii.match(/\\{(\\d+)\\s*-\\s*(\\d+)\\s*-\\s*(\\d+)\\}/);
        const d1 = m ? +m[1] : null;
        const d2 = m ? +m[2] : null;
        const d3 = m ? +m[3] : null;
        const sum = d1 != null ? d1 + d2 + d3 : null;
        const result = sum != null ? (sum > 10 ? "TAI" : "XIU") : null;

        let rawPeriod = null;
        for (let i = 0; i < bytes.length - 1; i++) {
          if (bytes[i] === 0x28) {
            const r = readVarint(bytes, i + 1);
            if (r.value >= 30000 && r.value <= 50000) {
              rawPeriod = r.value;
              break;
            }
          }
        }

        const entry = {
          time: new Date().toISOString(),
          dice: [d1, d2, d3],
          sum,
          result,
          period: rawPeriod,
          nextPeriod: rawPeriod != null ? rawPeriod + 1 : null
        };

        window.__taixiu_results.unshift(entry);
        if (window.__taixiu_results.length > 100) window.__taixiu_results.pop();

        console.log('[INJECT] __reportResult exists:', typeof window.__reportResult);
        if (window.__reportResult) window.__reportResult(entry);
      } catch (err) {
        console.error('[INJECT ERROR]', err);
      }
    });

    return ws;
  };

  window.WebSocket.prototype = O.prototype;
  console.log('[INJECT] WebSocket hooked OK');
})();
`;

module.exports = { INJECT_SCRIPT };
