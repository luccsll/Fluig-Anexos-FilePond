/*
 * Anexo com FilePond no formulário do Fluig.
 * O FilePond é só a área de arrastar e soltar: o arquivo vai para o upload
 * nativo do Fluig e aparece na aba Anexos. O documento aparece no card
 * (imagem direto, PDF renderizado pelo pdf.js).
 * Criado por Lucas Lima · lucaslima.dev
 */
var Anexo = (function ($) {
    'use strict';

    var EXTENSOES = ['.pdf', '.jpg', '.jpeg', '.png'];
    var MAX_KB = 2048;
    var PAGINAS_NA_PREVIA = 2;

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    function criar(opcoes) {
        var $card = $(opcoes.card);
        var $nome = $card.find(opcoes.nome);
        var $previa = $card.find(opcoes.previa);

        var pond = FilePond.create($card.find(opcoes.input)[0], {
            allowMultiple: false,
            credits: false,
            labelIdle:
                '<p class="anexoLabel">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>' +
                'Arraste o documento aqui <span>ou</span> <span class="filepond--label-action">clique para selecionar</span></p>'
        });

        pond.on('addfile', function (erro, item) {
            if (erro) {
                avisar('Não foi possível adicionar o arquivo selecionado.', 'danger');
                return;
            }

            var arquivo = item.file;
            var mensagem = validar(arquivo);

            if (mensagem) {
                pond.removeFile(item.id);
                avisar(mensagem, 'danger');
                return;
            }

            if (!enviarParaOFluig(arquivo)) {
                avisar('Abra o formulário numa solicitação do Fluig para anexar.', 'warning');
            }

            $nome.val(arquivo.name);
            $card.addClass('temAnexo');
            mostrarPrevia(arquivo, $previa);
        });

        $card.find(opcoes.remover).on('click', function () {
            var nomeArquivo = $nome.val();

            removerDoFluig(nomeArquivo);
            avisar('Anexo "' + nomeArquivo + '" removido. Selecione o novo arquivo.', 'success');

            $nome.val('');
            $previa.empty();
            $card.removeClass('temAnexo');
            pond.removeFiles();

            // O FilePond recalcula a altura da área quando ela volta a aparecer
            requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
        });

        return pond;
    }

    function validar(arquivo) {
        var nome = arquivo.name.toLowerCase();
        var extensaoOk = $.grep(EXTENSOES, function (ext) { return nome.slice(-ext.length) === ext; }).length > 0;

        if (!extensaoOk) return 'Tipo de arquivo não suportado. Envie um arquivo .pdf, .jpg, .jpeg ou .png.';
        if (arquivo.size > MAX_KB * 1024) return 'Arquivo muito grande. O tamanho máximo é ' + (MAX_KB / 1024) + ' MB.';
        return null;
    }

    // Coloca o arquivo no input de upload da tela da solicitação e dispara o "change".
    // O Fluig faz o upload do jeito dele, e o arquivo aparece na aba Anexos.
    function enviarParaOFluig(arquivo) {
        try {
            var $pai = window.parent !== window && window.parent.$;
            var uploadFluig = $pai && $pai('input[type="file"]')[0];
            if (!uploadFluig) return false;

            var transferencia = new DataTransfer();
            transferencia.items.add(arquivo);
            uploadFluig.files = transferencia.files;
            $pai(uploadFluig).trigger('change');
            return true;
        } catch (e) {
            console.error('[anexo] Falha ao anexar no Fluig:', e);
            return false;
        }
    }

    // Procura o anexo pelo nome na aba Anexos e remove do processo.
    function removerDoFluig(nome) {
        try {
            var anexos = window.parent.ECM.attachmentTable.getData();
            $.each(anexos, function (i, anexo) {
                if (anexo.description === nome) {
                    window.parent.WKFViewAttachment.removeAttach([i]);
                    return false;
                }
            });
        } catch (e) {
            console.error('[anexo] Falha ao remover do Fluig:', e);
        }
    }

    // Mostra o documento no card: imagem direto, PDF página por página.
    function mostrarPrevia(arquivo, $previa) {
        $previa.empty();

        if (arquivo.type.indexOf('image/') === 0) {
            $('<img>', { alt: arquivo.name, src: URL.createObjectURL(arquivo) }).appendTo($previa);
            return;
        }

        if (arquivo.type === 'application/pdf') {
            arquivo.arrayBuffer()
                .then(function (dados) { return pdfjsLib.getDocument({ data: dados }).promise; })
                .then(function (pdf) {
                    var total = Math.min(pdf.numPages, PAGINAS_NA_PREVIA);
                    var fila = Promise.resolve();
                    for (var n = 1; n <= total; n++) {
                        (function (numero) {
                            fila = fila.then(function () { return desenharPagina(pdf, numero, $previa); });
                        })(n);
                    }
                    return fila;
                })
                .catch(function (e) {
                    console.error('[anexo] Falha ao gerar a prévia do PDF:', e);
                });
        }
    }

    function desenharPagina(pdf, numero, $previa) {
        return pdf.getPage(numero).then(function (pagina) {
            var viewport = pagina.getViewport({ scale: 2 });
            var $canvas = $('<canvas>').attr({ width: viewport.width, height: viewport.height }).appendTo($previa);
            return pagina.render({ canvasContext: $canvas[0].getContext('2d'), viewport: viewport }).promise;
        });
    }

    function avisar(mensagem, tipo) {
        if (window.FLUIGC && FLUIGC.toast) FLUIGC.toast({ message: mensagem, type: tipo, timeout: 3000 });
        else console.info('[anexo] ' + mensagem);
    }

    return { criar: criar };
})(jQuery);

$(function () {
    Anexo.criar({
        card: '.cardAnexo',
        input: '.anexo-pond',
        previa: '#previaAnexo',
        nome: '#nomeAnexo',
        remover: '#removerAnexo'
    });
});
