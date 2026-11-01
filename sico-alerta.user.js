// ==UserScript==
// @name         SICO - ALERTA
// @namespace    http://tampermonkey.net/
// @version      7.9.3
// @description  Versión 7.9.3 - Prueba de actualización automática remota
// @match        *://www.brysonhillsperu.pe:8080/sistemadecontrol/*
// @updateURL    https://raw.githubusercontent.com/JoseOrVi/SICO/refs/heads/main/sico-alerta.user.js
// @downloadURL  https://raw.githubusercontent.com/JoseOrVi/SICO/refs/heads/main/sico-alerta.user.js
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// @connect      googleusercontent.com
// @connect      api.telegram.org
// ==/UserScript==

(function() {
    'use strict';

    const CSV_URL = 'https://docs.google.com/spreadsheets/d/1OiKBrjgOTj9IyWM-SWJeo-4u6_nnYNUuV8Mq8IwtVis/gviz/tq?tqx=out:csv';
    const TELEGRAM_TOKEN = '8851097774:AAELu-_TSiCE-rx3_da3PxtGR22hlhxg8pE';
    const TELEGRAM_CHAT_ID = '-1003929518182';

    let listaRegistros = [];
    let sistemaApagado = false;

    function normalizarPlaca(str) {
        if (!str) return '';
        return str.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function normalizarTexto(str) {
        if (!str) return '';
        return str.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function limpiarEspacios(str) {
        if (!str) return '';
        return str.toString().replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
    }

    function escaparHTML(texto) {
        if (!texto) return '';
        return texto.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function clasificarTipo(tipoCrudo) {
        const t = normalizarTexto(tipoCrudo);

        if (t === 'SILENCIOSO' || t === 'CONTROL' || t === 'SEGUIMIENTO') {
            return {
                categoria: 'SILENCIOSO',
                esSilencioso: true,
                icono: '🕵️‍♂️',
                tituloTelegram: '🕵️‍♂️ SEGUIMIENTO SILENCIOSO - SICO'
            };
        }

        if (t === 'PREVENTIVO' || t === 'ATENCION' || t === 'ALERTA') {
            return {
                categoria: 'PREVENTIVO',
                esSilencioso: false,
                icono: '🟠',
                tituloModal: 'CONTROL PREVENTIVO / FISCALIZACIÓN',
                colorFila: '#fff3e0',
                colorBorde: '#fb8c00',
                colorFondoCaja: '#fff8e1',
                colorTextoCaja: '#e65100',
                etiqueta: '⚠️ [PREVENTIVO]',
                colorEtiqueta: '#e65100',
                textoBoton: 'ALERTA RECIBIDA',
                colorBoton: '#fb8c00',
                tituloTelegram: '🟠 AVISO PREVENTIVO EN GARITA - SICO',
                instruccion: 'Entidad de fiscalización o inspección en curso. Notifique de inmediato al supervisor antes de autorizar.'
            };
        }

        if (t === 'VIP') {
            return {
                categoria: 'VIP',
                esSilencioso: false,
                icono: '⭐',
                tituloModal: 'VISITA PROTOCOLAR / VIP',
                colorFila: '#fff8e1',
                colorBorde: '#fbc02d',
                colorFondoCaja: '#fffde7',
                colorTextoCaja: '#f57f17',
                etiqueta: '⭐ [VIP]',
                colorEtiqueta: '#f57f17',
                textoBoton: 'ENTENDIDO / PROCEDER',
                colorBoton: '#fbc02d',
                tituloTelegram: '⭐ INGRESO VIP EN GARITA - SICO',
                instruccion: 'Atención preferencial. Verifique anfitrión y coordine pase prioritario sin dilación.'
            };
        }

        if (t === 'VISITA' || t === 'PROGRAMADO') {
            return {
                categoria: 'VISITA',
                esSilencioso: false,
                icono: '🟡',
                tituloModal: 'VISITA PROGRAMADA',
                colorFila: '#fffde7',
                colorBorde: '#fdd835',
                colorFondoCaja: '#ffffea',
                colorTextoCaja: '#f57f17',
                etiqueta: '🟡 [VISITA]',
                colorEtiqueta: '#c49000',
                textoBoton: 'ENTENDIDO / PROCEDER',
                colorBoton: '#fbc02d',
                tituloTelegram: '🟡 VISITA PROGRAMADA EN GARITA - SICO',
                instruccion: 'Proveedor o visita con coordinación previa. Confirme destino y entregue el pase correspondiente.'
            };
        }

        return {
            categoria: 'RESTRICCION',
            esSilencioso: false,
            icono: '🚨',
            tituloModal: 'UNIDAD CON RESTRICCIÓN',
            colorFila: '#ffebee',
            colorBorde: '#d9534f',
            colorFondoCaja: '#fff3f3',
            colorTextoCaja: '#b71c1c',
            etiqueta: '⛔ [RESTRINGIDO]',
            colorEtiqueta: '#6a1b9a',
            textoBoton: 'ALERTA RECIBIDA',
            colorBoton: '#d9534f',
            tituloTelegram: '🚨 ALERTA EN GARITA - SICO',
            instruccion: 'Estacione la unidad a un costado y verifique antes de continuar.'
        };
    }

    function notificarTelegram(placa, tipoMovimiento, cfg, motivo, datosSico) {
        if (sistemaApagado) return;
        const ahora = new Date();
        const fechaHora = ahora.toLocaleString('es-PE', { hour12: true });

        const empresa = datosSico.empresa || 'No registrada';
        const personas = datosSico.personas || 'No registradas';
        const destino = datosSico.destino || 'No especificado';

        const mensajeHTML = 
            `<b>${cfg.tituloTelegram}</b>\n\n` +
            `🚘 <b>Placa:</b> <code>${escaparHTML(placa)}</code>\n` +
            `🔄 <b>Movimiento:</b> <b>${escaparHTML(tipoMovimiento)}</b>\n` +
            `🏢 <b>Empresa:</b> ${escaparHTML(empresa)}\n` +
            `👤 <b>Personas:</b> ${escaparHTML(personas)}\n` +
            `📍 <b>Destino:</b> ${escaparHTML(destino)}\n` +
            `${cfg.icono} <b>Tipo:</b> ${escaparHTML(cfg.categoria)}\n` +
            `📋 <b>Detalle:</b> ${escaparHTML(motivo)}\n` +
            `⏰ <b>Fecha/Hora:</b> ${fechaHora}\n\n` +
            `#AlertaGarita #${cfg.categoria} #Placa_${placa}`;

        const urlTelegram = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${encodeURIComponent(TELEGRAM_CHAT_ID)}&text=${encodeURIComponent(mensajeHTML)}&parse_mode=HTML`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: urlTelegram,
            onload: function(r) {
                if (r.status !== 200) {
                    console.error("Telegram rechazó el envío:", r.responseText);
                }
            }
        });
    }

    function sincronizarRegistros() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: CSV_URL,
            onload: function(response) {
                if (response.status === 200) {
                    const lineas = response.responseText.split(/\r?\n/);
                    const nuevaLista = [];
                    let apagadoDetectado = false;

                    lineas.forEach((linea, index) => {
                        if (!linea.trim()) return;
                        const columnas = linea.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
                        
                        const filaTexto = linea.toUpperCase();
                        if (filaTexto.includes('APAGAR') || filaTexto.includes('OFF')) {
                            apagadoDetectado = true;
                        }

                        if (index === 0) return;

                        if (columnas.length >= 2) {
                            const placaLimpia = normalizarPlaca(columnas[0]);
                            const tipo = (columnas[1] || 'AMBOS').toUpperCase();
                            const motivo = columnas[2] || 'Sin motivo especificado';

                            if (placaLimpia) {
                                nuevaLista.push({ placa: placaLimpia, tipo: tipo, motivo: motivo });
                            }
                        }
                    });

                    sistemaApagado = apagadoDetectado;
                    if (!sistemaApagado) {
                        listaRegistros = nuevaLista;
                    } else {
                        listaRegistros = [];
                    }
                }
            }
        });
    }

    sincronizarRegistros();
    setInterval(sincronizarRegistros, 180000);

    function limpiarYEnfocarBuscador() {
        if (sistemaApagado) return;
        const inputTexto = document.querySelector('input[type="text"][placeholder*="buscar"], input[type="text"][placeholder*="Texto"], input[type="text"]');
        if (!inputTexto) return;

        inputTexto.value = '';
        inputTexto.dispatchEvent(new Event('input', { bubbles: true }));
        inputTexto.dispatchEvent(new Event('change', { bubbles: true }));

        inputTexto.focus();
        inputTexto.click();

        setTimeout(() => {
            inputTexto.focus();
            inputTexto.click();
        }, 150);
    }

    function mostrarAvisoFlash(mensaje, colorFondo, colorTexto = '#ffffff') {
        if (sistemaApagado) return;
        let toast = document.getElementById('sico-toast-aviso');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sico-toast-aviso';
            toast.style.position = 'fixed';
            toast.style.top = '16%';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.zIndex = '9999999';
            toast.style.padding = '14px 26px';
            toast.style.fontSize = '18px';
            toast.style.fontWeight = 'bold';
            toast.style.borderRadius = '8px';
            toast.style.boxShadow = '0 6px 24px rgba(0,0,0,0.45)';
            toast.style.textAlign = 'center';
            toast.style.pointerEvents = 'none';
            toast.style.transition = 'opacity 0.2s ease-in-out';
            document.body.appendChild(toast);
        }

        toast.innerText = mensaje;
        toast.style.backgroundColor = colorFondo;
        toast.style.color = colorTexto;
        toast.style.opacity = '1';
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 200);
        }, 1400);
    }

    function mostrarAvisoBusqueda(lineasTexto, esPreventivo = false) {
        if (sistemaApagado) return;
        let toast = document.getElementById('sico-toast-busqueda');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sico-toast-busqueda';
            toast.style.position = 'fixed';
            toast.style.top = '8px';
            toast.style.left = '175px';
            toast.style.right = '10px';
            toast.style.boxSizing = 'border-box';
            toast.style.zIndex = '9999999';
            toast.style.padding = '6px 10px';
            toast.style.fontSize = '14.5px';
            toast.style.fontWeight = 'bold';
            toast.style.borderRadius = '6px';
            toast.style.textAlign = 'left';
            toast.style.pointerEvents = 'none';
            toast.style.transition = 'opacity 0.2s ease-in-out';
            document.body.appendChild(toast);
        }

        if (esPreventivo) {
            toast.style.backgroundColor = 'transparent';
            toast.style.color = '#ff9100';
            toast.style.border = '2px solid #ff9100';
        } else {
            toast.style.backgroundColor = 'transparent';
            toast.style.color = '#ff1744';
            toast.style.border = '2px solid #ff1744';
        }

        toast.innerHTML = lineasTexto.map(l => `<span style="color: inherit !important; display: block;">${l}</span>`).join('');
        toast.style.opacity = '1';
        toast.style.display = 'block';
    }

    function ocultarAvisoBusqueda() {
        let toast = document.getElementById('sico-toast-busqueda');
        if (toast) {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 200);
        }
    }

    function inicializarMonitoreoBuscador() {
        const inputTexto = document.querySelector('input[type="text"][placeholder*="buscar"], input[type="text"][placeholder*="Texto"], input[type="text"]');
        if (!inputTexto || inputTexto.dataset.monitorListener) return;
        inputTexto.dataset.monitorListener = "true";

        inputTexto.addEventListener('input', function() {
            if (sistemaApagado) return;
            const query = normalizarPlaca(inputTexto.value);

            if (query.length >= 3) {
                const coincidencias = listaRegistros.filter(r => {
                    const cfg = clasificarTipo(r.tipo);
                    return (cfg.categoria === 'RESTRICCION' || cfg.categoria === 'PREVENTIVO') && r.placa.includes(query);
                });

                if (coincidencias.length > 0) {
                    let lineasMensaje = [];
                    let hayRestriccionCritica = false;

                    coincidencias.forEach(c => {
                        const cfgMatch = clasificarTipo(c.tipo);
                        const preventivo = (cfgMatch.categoria === 'PREVENTIVO');
                        if (!preventivo) hayRestriccionCritica = true;

                        const etiquetaTipo = preventivo ? 'PREV' : 'REST';
                        lineasMensaje.push(`⚠️ [${etiquetaTipo}] <b>${c.placa}</b>: ${c.motivo}`);
                    });

                    mostrarAvisoBusqueda(lineasMensaje, !hayRestriccionCritica);
                } else {
                    ocultarAvisoBusqueda();
                }
            } else {
                ocultarAvisoBusqueda();
            }
        });
    }

    function mostrarModalOperativo(info, cfg, callbackContinuar) {
        if (sistemaApagado) return;
        const modalId = 'sico-modal-operativo';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background-color:rgba(0,0,0,0.75);z-index:99999999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

        modal.innerHTML = `
            <div style="background: #ffffff; border-top: 8px solid ${cfg.colorBorde}; border-radius: 10px; max-width: 420px; width: 100%; padding: 24px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: sans-serif;">
                <div style="font-size: 45px; line-height: 1; margin-bottom: 10px;">${cfg.icono}</div>
                <h2 style="color: ${cfg.colorTextoCaja}; margin: 0 0 10px 0; font-size: 21px;">${cfg.tituloModal}</h2>
                <div style="background: ${cfg.colorFondoCaja}; border: 1px solid ${cfg.colorBorde}; border-radius: 6px; padding: 12px; margin-bottom: 15px; text-align: left; font-size: 15px; color: #333;">
                    <p style="margin: 4px 0;"><strong>Placa:</strong> <span style="color: ${cfg.colorTextoCaja}; font-weight: bold;">${info.placa}</span></p>
                    <p style="margin: 4px 0;"><strong>Categoría:</strong> <span style="font-weight: bold;">${cfg.categoria}</span></p>
                    <p style="margin: 4px 0;"><strong>Detalle:</strong> ${info.motivo}</p>
                </div>
                <p style="color: #666; font-size: 13px; margin-bottom: 20px;">${cfg.instruccion}</p>
                <button id="btn-modal-operativo" style="background: ${cfg.colorBoton}; color: #ffffff; border: none; padding: 14px 20px; font-size: 16px; font-weight: bold; border-radius: 6px; width: 100%; cursor: pointer;">${cfg.textoBoton}</button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('btn-modal-operativo').addEventListener('click', () => {
            modal.remove();
            callbackContinuar();
        });
    }

    function autoCerrarBotonOk() {
        if (sistemaApagado) return;
        const botonesModal = document.querySelectorAll('.sweet-alert button, .swal2-actions button, .sa-confirm-button-container button');
        botonesModal.forEach(btn => {
            const txt = btn.innerText.trim().toUpperCase();
            if (txt === 'OK' && btn.offsetParent !== null) {
                btn.click();
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

                setTimeout(limpiarYEnfocarBuscador, 450);
            }
        });
    }

    function procesarTabla() {
        if (sistemaApagado) return;
        inicializarMonitoreoBuscador();

        const filas = document.querySelectorAll('table tbody tr');
        const ahora = new Date();
        const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

        filas.forEach(fila => {
            const celdas = fila.querySelectorAll('td');
            if (celdas.length < 8) return;

            const btnAccion = celdas[0]?.querySelector('a, button, input[type="checkbox"], img, span');
            const celdaEmpresa = celdas[1];
            const celdaPlaca = celdas[2];
            const celdaDestino = celdas[3];
            const celdaPersonas = celdas[5];
            const celdaPeriodo = celdas[6];

            const textoPeriodo = celdaPeriodo?.innerText || '';
            const placaTexto = celdaPlaca?.innerText || '';
            const placaLimpia = normalizarPlaca(placaTexto);

            const datosSico = {
                empresa: limpiarEspacios(celdaEmpresa?.innerText || ''),
                destino: limpiarEspacios(celdaDestino?.innerText || ''),
                personas: limpiarEspacios(celdaPersonas?.innerText || '')
            };

            const registroEncontrado = listaRegistros.find(r => r.placa === placaLimpia);
            let matchActivo = false;
            let cfg = null;

            if (registroEncontrado) {
                cfg = clasificarTipo(registroEncontrado.tipo);

                let estadoFilaActual = '';
                for (let i = celdas.length - 1; i >= 0; i--) {
                    const txt = celdas[i].innerText.trim().toUpperCase();
                    if (txt === 'INGRESO' || txt === 'SALIDA' || txt === 'PENDIENTE') {
                        estadoFilaActual = txt;
                        break;
                    }
                }
                const vaAIngresarFila = (estadoFilaActual === 'SALIDA' || estadoFilaActual === 'PENDIENTE');
                const vaASalirFila = (estadoFilaActual === 'INGRESO');

                if (cfg.categoria === 'RESTRICCION') {
                    const tipoNormalizado = normalizarTexto(registroEncontrado.tipo);
                    if (tipoNormalizado === 'INGRESO') {
                        matchActivo = vaAIngresarFila;
                    } else if (tipoNormalizado === 'SALIDA') {
                        matchActivo = vaASalirFila;
                    } else {
                        matchActivo = true;
                    }
                } else {
                    matchActivo = true;
                }
            }

            if (matchActivo && cfg && !cfg.esSilencioso) {
                fila.style.backgroundColor = cfg.colorFila;
                if (celdaPlaca && !celdaPlaca.innerHTML.includes(cfg.etiqueta)) {
                    celdaPlaca.innerHTML = `<span style="color: ${cfg.colorEtiqueta}; font-weight: bold;">${cfg.etiqueta}</span><br>` + celdaPlaca.innerHTML;
                }
            } else {
                if (textoPeriodo.includes('TEMPORAL') || textoPeriodo.includes('OCASIONAL')) {
                    const fechas = textoPeriodo.match(/\d{4}-\d{2}-\d{2}/g);
                    if (fechas) {
                        const partesFecha = fechas[fechas.length - 1].split('-');
                        const fechaFin = new Date(parseInt(partesFecha[0]), parseInt(partesFecha[1]) - 1, parseInt(partesFecha[2]));
                        const diffDias = Math.round((fechaFin - hoy) / (1000 * 60 * 60 * 24));

                        let bg = '', fg = '';
                        if (diffDias < 0) {
                            bg = '#ffcdd2'; fg = '#b71c1c';
                        } else if (diffDias === 0) {
                            bg = '#ffe0b2'; fg = '#e65100';
                        }

                        if (bg && fg) {
                            celdaPeriodo.style.backgroundColor = bg;
                            celdaPeriodo.style.color = fg;
                            celdaPeriodo.style.fontWeight = 'bold';

                            if (celdaPlaca) {
                                celdaPlaca.style.backgroundColor = bg;
                                celdaPlaca.style.color = fg;
                                celdaPlaca.style.fontWeight = 'bold';
                            }
                        }
                    }
                }
            }

            if (btnAccion && !btnAccion.dataset.sicoSilentHook) {
                btnAccion.dataset.sicoSilentHook = "true";

                btnAccion.addEventListener('click', function(e) {
                    if (sistemaApagado) return;
                    if (btnAccion.dataset.autorizadoUnaVez === "true") {
                        delete btnAccion.dataset.autorizadoUnaVez;
                        return;
                    }

                    let estadoClickEval = '';
                    const celdasClick = fila.querySelectorAll('td');
                    for (let j = celdasClick.length - 1; j >= 0; j--) {
                        const txtClick = celdasClick[j].innerText.trim().toUpperCase();
                        if (txtClick === 'INGRESO' || txtClick === 'SALIDA' || txtClick === 'PENDIENTE') {
                            estadoClickEval = txtClick;
                            break;
                        }
                    }
                    if (!estadoClickEval) {
                        const htmlFilaClick = fila.innerHTML.toUpperCase();
                        if (htmlFilaClick.includes('SALIDA')) estadoClickEval = 'SALIDA';
                        else if (htmlFilaClick.includes('INGRESO')) estadoClickEval = 'INGRESO';
                    }

                    const movimientoNombre = (estadoClickEval === 'SALIDA' || estadoClickEval === 'PENDIENTE') ? 'INGRESO' : 'SALIDA';

                    if (matchActivo && cfg && cfg.esSilencioso) {
                        notificarTelegram(registroEncontrado.placa, movimientoNombre, cfg, registroEncontrado.motivo, datosSico);
                    }
                    else if (matchActivo && cfg && !cfg.esSilencioso) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();

                        notificarTelegram(registroEncontrado.placa, movimientoNombre, cfg, registroEncontrado.motivo, datosSico);

                        mostrarModalOperativo(registroEncontrado, cfg, () => {
                            btnAccion.dataset.autorizadoUnaVez = "true";
                            btnAccion.click();
                        });
                        return false;
                    }

                    const esAccionIngreso = (estadoClickEval === 'SALIDA' || estadoClickEval === 'PENDIENTE');

                    if (esAccionIngreso) {
                        mostrarAvisoFlash("➔ Vas a registrar un INGRESO", "#76FF03", "#000000");
                    } else {
                        mostrarAvisoFlash("➔ Vas a registrar una SALIDA", "#0066FF", "#ffffff");
                    }
                }, true);
            }
        });
    }

    setInterval(() => {
        procesarTabla();
        autoCerrarBotonOk();
    }, 120);

})();