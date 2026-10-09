
      const endpoint = "https://lanternandledger.goatcounter.com/count";
      const goatcounterScriptPre = document.createElement('script');
      goatcounterScriptPre.textContent = `
        window.goatcounter = { no_onload: true, endpoint: "https://lanternandledger.goatcounter.com/count" };
      `;
      document.head.appendChild(goatcounterScriptPre);

      const pendingPageviews = [];
      const getGoatcounterPath = () => {
        const path = location.pathname;
        return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
      };
      const countPageview = () => {
        const path = getGoatcounterPath();
        if (typeof window.goatcounter?.count === 'function') {
          window.goatcounter.count({ path });
        } else {
          pendingPageviews.push(path);
        }
      };
      document.addEventListener('nav', countPageview);

      const goatcounterScript = document.createElement('script');
      goatcounterScript.src = "https://gc.zgo.at/count.js";
      goatcounterScript.defer = true;
      goatcounterScript.setAttribute('data-goatcounter', endpoint);
      goatcounterScript.onload = () => {
        window.goatcounter.endpoint = endpoint;
        for (const path of pendingPageviews.splice(0)) {
          window.goatcounter.count({ path });
        }
      };

      document.head.appendChild(goatcounterScript);
    