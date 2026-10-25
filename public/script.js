// =====================================================================
// PERGUNTAS
// Adicione, remova ou troque perguntas nesta lista.
// - id: nome EXATO do campo na Bolten (ex.: "Nome", "E-mail"); se não bater, a Bolten ignora
// - tipo: "texto", "whatsapp", "email", "escolha" (uma resposta) ou "multipla" (várias respostas)
// - pergunta: texto mostrado na tela
// - opcoes: só para os tipos "escolha" e "multipla" (lista de botões)
// Os ids "faturamento" e "verba" são usados na qualificação (server.js).
// =====================================================================
const PERGUNTAS = [
  { id: "Nome", tipo: "texto", pergunta: "Qual seu nome?" },
  { id: "Telefone", tipo: "whatsapp", pergunta: "Qual é o seu WhatsApp?" },
  { id: "E-mail", tipo: "email", pergunta: "Qual é o seu melhor e-mail?" },
  { id: "empresa", tipo: "texto", pergunta: "Qual é o nome da sua empresa e o que ela vende?" },
  {
    id: "faturamento",
    tipo: "escolha",
    pergunta: "Qual a média de faturamento mensal da sua empresa?",
    opcoes: [
      "Menos de R$ 10 mil",
      "De R$ 10 mil a R$ 30 mil",
      "Mais de R$ 30 mil até R$ 60 mil",
      "Mais de R$ 60 mil até R$ 100 mil",
      "Mais de R$ 100 mil",
    ],
  },
  {
    id: "origem_clientes",
    tipo: "multipla",
    pergunta: "Hoje, como os seus clientes chegam até você?",
    opcoes: [
      "Por indicação de outras pessoas",
      "Pelo Instagram, Facebook ou outras redes",
      "Por anúncios pagos",
      "Chegam sozinhos, depende do movimento",
      "De outro jeito",
    ],
  },
  {
    id: "dificuldade",
    tipo: "escolha",
    pergunta: "O que mais atrapalha você a vender mais hoje?",
    opcoes: [
      "Entram poucos clientes",
      "Chegam clientes, mas poucos compram",
      "Uma hora vende bem, outra hora cai",
      "Já tentei anúncios e não deu certo",
      "Quero anunciar, mas não sei por onde começar",
      "Outro motivo",
    ],
  },
  {
    id: "verba",
    tipo: "escolha",
    pergunta: "Qual valor você consegue reservar por mês para marketing?",
    opcoes: [
      "Menos de R$ 1.200",
      "De R$ 1.200 a R$ 2.000",
      "Mais de R$ 2.000 até R$ 3.000",
      "Mais de R$ 3.000 até R$ 4.000",
      "Mais de R$ 4.000",
      "Ainda não sei",
    ],
  },
];

// Textos da abertura e da tela final
const TEXTOS = {
  titulo: "Vamos conversar sobre o seu negócio",
  subtitulo: "Leva cerca de 2 minutos.",
  finalQualificado: "Tudo certo! Recebemos suas respostas e vamos entrar em contato pelo seu WhatsApp em breve.",
  finalNaoQualificado:
    "Obrigado pelas respostas! Pelo que você nos contou, este ainda não é o momento ideal para trabalharmos juntos.",
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

  if (p.tipo === "multipla") {
    const marcadas = new Set(respostas[p.id] || []);
    const opcoes = p.opcoes
      .map((opcao) => {
        const classe = marcadas.has(opcao) ? "opcao selecionada" : "opcao";
        return `<button type="button" class="${classe}">${escapar(opcao)}</button>`;
      })
      .join("");

    mostrar(
      `${cabecalho}
       <form id="form" novalidate>
         <div class="opcoes">${opcoes}</div>
         <p class="erro" id="erro"></p>
         <button type="submit" class="botao">Continuar</button>
       </form>
       ${voltar}`,
      () => {
        const form = document.getElementById("form");
        const erro = document.getElementById("erro");
        const botoes = tela.querySelectorAll(".opcao");

        botoes.forEach((botao, i) => {
          // Clique (ou espaço) marca/desmarca
          botao.addEventListener("click", () => {
            const opcao = p.opcoes[i];
            if (marcadas.has(opcao)) marcadas.delete(opcao);
            else marcadas.add(opcao);
            botao.classList.toggle("selecionada");
            erro.textContent = "";
          });
          // Enter avança
          botao.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              form.requestSubmit();
            }
          });
        });

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (marcadas.size === 0) {
            erro.textContent = "Escolha pelo menos uma opção.";
            return;
          }
          // Mantém a ordem da lista de opções
          respostas[p.id] = p.opcoes.filter((opcao) => marcadas.has(opcao));
          avancar();
        });

        document.getElementById("voltar").addEventListener("click", voltarTela);
        botoes[0].focus();
      }
    );
    return;
  }

  const atributos = {
    texto: p.id === "Nome" ? 'type="text" autocomplete="name"' : 'type="text"',
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

  // Envia cada resposta junto com o texto da pergunta, na ordem da lista
  const dados = PERGUNTAS.map((p) => ({ id: p.id, pergunta: p.pergunta, resposta: respostas[p.id] }));

  try {
    const resposta = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas: dados }),
    });
    if (!resposta.ok) throw new Error("Falha no envio");
    const resultado = await resposta.json();
    mostrarFinal(resultado.qualificado);
  } catch (e) {
    mostrarFalha();
  }
}

function mostrarFinal(qualificado) {
  const texto = qualificado ? TEXTOS.finalQualificado : TEXTOS.finalNaoQualificado;
  mostrar(`<h2>${escapar(texto)}</h2>`);
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
