// =====================================================================
// PERGUNTAS
// Adicione, remova ou troque perguntas nesta lista.
// - id: nome EXATO do campo na Bolten (ex.: "Nome", "E-mail"); se não bater, a Bolten ignora
// - tipo: "texto", "whatsapp", "email" ou "escolha"
// - pergunta: texto mostrado na tela
// - opcoes: só para o tipo "escolha" (lista de botões)
// =====================================================================
const PERGUNTAS = [
  { id: "Nome", tipo: "texto", pergunta: "Qual é o seu nome?" },
  { id: "Telefone", tipo: "whatsapp", pergunta: "Qual é o seu WhatsApp?" },
  { id: "E-mail", tipo: "email", pergunta: "Qual é o seu e-mail?" },
  // Exemplo de múltipla escolha:
  // { id: "faturamento", tipo: "escolha", pergunta: "Qual é o seu faturamento mensal?", opcoes: ["Até R$ 50 mil", "De R$ 50 mil a R$ 200 mil", "Acima de R$ 200 mil"] },
];

// Textos da abertura e do agradecimento
const TEXTOS = {
  titulo: "Vamos conversar sobre o seu negócio",
  subtitulo: "Leva menos de 1 minuto.",
  agradecimentoTitulo: "Obrigado!",
  agradecimentoTexto: "Recebemos suas informações e entraremos em contato em breve.",
};

// =====================================================================
// Daqui para baixo é a lógica do formulário.
// =====================================================================

const tela = document.getElementById("tela");
const barra = document.getElementById("progresso-barra");
const respostas = {};
let atual = 0;
let trocando = false; // evita pular telas com clique duplo

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function atualizarProgresso(fracao) {
  barra.style.width = fracao * 100 + "%";
}

// Troca o conteúdo da tela com uma transição suave
function mostrar(html, aoMostrar) {
  trocando = true;
  tela.classList.add("oculta");
  setTimeout(() => {
    trocando = false;
    tela.innerHTML = html;
    window.scrollTo(0, 0);
    tela.classList.remove("oculta");
    if (aoMostrar) aoMostrar();
  }, 250);
}

// ----- Abertura -----
function mostrarAbertura() {
  atualizarProgresso(0);
  mostrar(
    `<h1>${escapar(TEXTOS.titulo)}</h1>
     <p class="subtitulo">${escapar(TEXTOS.subtitulo)}</p>
     <button class="botao" id="comecar">Começar</button>`,
    () => {
      const botao = document.getElementById("comecar");
      botao.addEventListener("click", () => mostrarPergunta(0));
      botao.focus();
    }
  );
}

// ----- Perguntas -----
function mostrarPergunta(indice) {
  atual = indice;
  const p = PERGUNTAS[indice];
  atualizarProgresso(indice / PERGUNTAS.length);

  const cabecalho = `
    <p class="contador">${indice + 1} de ${PERGUNTAS.length}</p>
    <h2>${escapar(p.pergunta)}</h2>`;
  const voltar = `<button type="button" class="voltar" id="voltar">← Voltar</button>`;

  if (p.tipo === "escolha") {
    const opcoes = p.opcoes
      .map((opcao) => {
        const classe = respostas[p.id] === opcao ? "opcao selecionada" : "opcao";
        return `<button type="button" class="${classe}">${escapar(opcao)}</button>`;
      })
      .join("");

    mostrar(`${cabecalho}<div class="opcoes">${opcoes}</div>${voltar}`, () => {
      const botoes = tela.querySelectorAll(".opcao");
      botoes.forEach((botao, i) => {
        botao.addEventListener("click", () => {
          respostas[p.id] = p.opcoes[i];
          avancar();
        });
      });
      (tela.querySelector(".opcao.selecionada") || botoes[0]).focus();
      document.getElementById("voltar").addEventListener("click", voltarTela);
    });
    return;
  }

  const atributos = {
    texto: 'type="text" autocomplete="name"',
    whatsapp: 'type="tel" inputmode="numeric" autocomplete="tel" placeholder="(99) 99999-9999"',
    email: 'type="email" inputmode="email" autocomplete="email" placeholder="nome@exemplo.com"',
  }[p.tipo];

  mostrar(
    `${cabecalho}
     <form id="form" novalidate>
       <input class="campo" id="campo" ${atributos}>
       <p class="erro" id="erro"></p>
       <button type="submit" class="botao">Continuar</button>
     </form>
     ${voltar}`,
    () => {
      const campo = document.getElementById("campo");
      campo.value = respostas[p.id] || "";

      if (p.tipo === "whatsapp") {
        campo.addEventListener("input", () => {
          campo.value = mascaraWhatsapp(campo.value);
        });
      }
      campo.addEventListener("input", () => limparErro(campo));

      // Enter dentro do campo envia o form, que avança
      document.getElementById("form").addEventListener("submit", (e) => {
        e.preventDefault();
        const valor = campo.value.trim();
        const erro = validar(p.tipo, valor);
        if (erro) {
          mostrarErro(campo, erro);
          return;
        }
        respostas[p.id] = valor;
        avancar();
      });

      document.getElementById("voltar").addEventListener("click", voltarTela);
      campo.focus();
    }
  );
}

function avancar() {
  if (trocando) return;
  if (atual < PERGUNTAS.length - 1) {
    mostrarPergunta(atual + 1);
  } else {
    enviar();
  }
}

function voltarTela() {
  if (trocando) return;
  if (atual > 0) {
    mostrarPergunta(atual - 1);
  } else {
    mostrarAbertura();
  }
}

// ----- Validação -----
function validar(tipo, valor) {
  if (!valor) return "Por favor, preencha este campo.";
  if (tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
    return "Digite um e-mail válido.";
  }
  if (tipo === "whatsapp" && valor.replace(/\D/g, "").length !== 11) {
    return "Digite um WhatsApp válido com DDD.";
  }
  return "";
}

function mascaraWhatsapp(valor) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mostrarErro(campo, mensagem) {
  campo.classList.add("invalido");
  document.getElementById("erro").textContent = mensagem;
  campo.focus();
}

function limparErro(campo) {
  campo.classList.remove("invalido");
  document.getElementById("erro").textContent = "";
}

// ----- Envio -----
async function enviar() {
  atualizarProgresso(1);
  mostrar(`<h2>Enviando...</h2>`);

  try {
    const resposta = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(respostas),
    });
    if (!resposta.ok) throw new Error("Falha no envio");
    mostrarAgradecimento();
  } catch (e) {
    mostrarFalha();
  }
}

function mostrarAgradecimento() {
  mostrar(
    `<h1>${escapar(TEXTOS.agradecimentoTitulo)}</h1>
     <p class="subtitulo">${escapar(TEXTOS.agradecimentoTexto)}</p>`
  );
}

function mostrarFalha() {
  mostrar(
    `<h2>Ops, não conseguimos enviar agora.</h2>
     <p class="subtitulo">Verifique sua conexão e tente de novo. Suas respostas foram mantidas.</p>
     <button class="botao" id="tentar">Tentar novamente</button>
     <button type="button" class="voltar" id="voltar">← Voltar</button>`,
    () => {
      const botao = document.getElementById("tentar");
      botao.addEventListener("click", enviar);
      document.getElementById("voltar").addEventListener("click", () => mostrarPergunta(atual));
      botao.focus();
    }
  );
}

mostrarAbertura();
