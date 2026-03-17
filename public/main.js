document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("cards-input");
  const button = document.getElementById("calc-button");
  const statusEl = document.getElementById("status");
  const tbody = document.querySelector("#result-table tbody");
  const totalCell = document.getElementById("total-cell");

  button.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text) {
      setStatus("枚数とカード名を入力してください。", true);
      return;
    }

    button.disabled = true;
    setStatus("サーバーに問い合わせ中です…", false);
    tbody.innerHTML = "";
    totalCell.textContent = "-";
    totalCell.classList.remove("total-over");
    const summaryEl = document.getElementById("result-summary");
    summaryEl.textContent = "";
    summaryEl.setAttribute("aria-hidden", "true");

    try {
      const res = await fetch("/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list: text }),
      });

      if (!res.ok) {
        throw new Error(`HTTPエラー: ${res.status}`);
      }

      const data = await res.json();
      const detail = data.detail ?? [];
      const total = data.total ?? 0;

      for (const r of detail) {
        addRow(tbody, {
          name: r.name,
          qty: r.qty,
          unitPrice: r.price,
          subtotal: r.subtotal,
          error: r.error,
        });
      }

      const over = total >= 5001;
      totalCell.textContent = formatYen(total);
      totalCell.classList.toggle("total-over", over);

      const summaryEl = document.getElementById("result-summary");
      summaryEl.textContent = "";
      summaryEl.appendChild(document.createTextNode(`結果：${formatYen(total)}　`));
      const badge = document.createElement("span");
      badge.className = over ? "badge badge-over" : "badge badge-ok";
      badge.textContent = over ? "超過" : "適正";
      summaryEl.appendChild(badge);
      summaryEl.removeAttribute("aria-hidden");

      setStatus("取得完了しました。", false);
    } catch (err) {
      console.error(err);
      setStatus(`エラーが発生しました: ${err.message}`, true);
    } finally {
      button.disabled = false;
    }
  });

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", !!isError);
  }

  function addRow(tbody, { name, qty, unitPrice, subtotal, error }) {
    const tr = document.createElement("tr");
    if (error) tr.classList.add("row-error");

    const tdName = document.createElement("td");
    tdName.textContent = name;

    const tdQty = document.createElement("td");
    tdQty.textContent = qty;

    const tdUnit = document.createElement("td");
    tdUnit.textContent = error ? "エラー" : (unitPrice != null ? formatYen(Number(unitPrice) || 0) : "-");

    const tdSub = document.createElement("td");
    tdSub.textContent = error ? "エラー" : (subtotal != null ? formatYen(Number(subtotal) || 0) : "-");

    tr.appendChild(tdName);
    tr.appendChild(tdQty);
    tr.appendChild(tdUnit);
    tr.appendChild(tdSub);
    tbody.appendChild(tr);
  }

  function formatYen(v) {
    return `${Math.round(v).toLocaleString("ja-JP")} 円`;
  }

  const cacheClearBtn = document.getElementById("cache-clear-button");
  cacheClearBtn.addEventListener("click", async () => {
    cacheClearBtn.disabled = true;
    try {
      const res = await fetch("/cache/clear", { method: "POST" });
      if (res.ok) {
        setStatus("キャッシュをクリアしました。", false);
      } else {
        setStatus("キャッシュクリアに失敗しました。", true);
      }
    } catch (err) {
      setStatus(`エラー: ${err.message}`, true);
    } finally {
      cacheClearBtn.disabled = false;
    }
  });
});
