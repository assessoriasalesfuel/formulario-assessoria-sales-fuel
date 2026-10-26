const express = require("express");
const path = require("path");

const app = express();
const PORTA = process.env.PORT || 3000;

const BOLTEN_URL = "https://app.bolten.io";
const { BOLTEN_API_KEY, BOLTEN_FUNIL_ID, BOLTEN_CONTATOS_ID, BOLTEN_ETAPA } = process.env;

if (!BOLTEN_API_KEY || !BOLTEN_FUNIL_ID || !BOLTEN_CONTATOS_ID || !BOLTEN_ETAPA) {
  console.error("Faltam variáveis da Bolten (no arquivo .env ou no painel do EasyPanel).");
  process.exit(1);
}

// Coluna dos não qualificados. Se faltar, eles vão para BOLTEN_ETAPA (o formulário continua funcionando).
const BOLTEN_ETAPA_DESQUALIFICADO = process.env.BOLTEN_ETAPA_DESQUALIFICADO || BOLTEN_ETAPA;
if (!process.env.BOLTEN_ETAPA_DESQUALIFICADO) {
  console.warn(`Aviso: BOLTEN_ETAPA_DESQUALIFICADO não definida. Não qualificados irão para "${BOLTEN_ETAPA}".`);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// A Bolten aceita 1 requisição por segundo. Esta fila espaça todas as chamadas.
const INTERVALO_MS = 1100;
let fila = Promise.resolve();

function chamarBolten(metodo, caminho, corpo) {
  const chamada = fila.then(async () => {
    const resposta = await fetch(BOLTEN_URL + caminho, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${BOLTEN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(`Bolten ${metodo} ${caminho} -> ${resposta.status} ${JSON.stringify(dados)}`);
    }
    return dados;
  });
  fila = chamada.catch(() => {}).then(() => new Promise((r) => setTimeout(r, INTERVALO_MS)));
  return chamada;
}

// Qualificação: o lead é NÃO QUALIFICADO se responder alguma destas opções.
const DESQUALIFICA = {
  faturamento: "Menos de R$ 10 mil",
  verba: "Menos de R$ 1.200",
};

// Se a Bolten der erro, cada etapa é tentada de novo depois destas esperas (5 tentativas no total).
const ESPERAS_MS = [5000, 30000, 120000, 300000];

async function comTentativas(descricao, funcao) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await funcao();
    } catch (erro) {
      const total = ESPERAS_MS.length + 1;
      console.error(`Falha ao ${descricao} (tentativa ${tentativa} de ${total}): ${erro.message}`);
      if (tentativa === total) throw erro;
      await new Promise((r) => setTimeout(r, ESPERAS_MS[tentativa - 1]));
    }
  }
}

// Cria contato + oportunidade na Bolten e associa os dois.
// O contato recebe Nome, Telefone e E-mail. A oportunidade entra na etapa
// recebida em "etapa", com a qualificação e todas as respostas na Observação.
// Cada etapa tem suas próprias tentativas, então nada é criado em dobro.
// "progresso" guarda o que já foi criado, para o aviso de erro.
async function salvarNaBolten(respostas, observacao, etapa, progresso) {
  const contato = await comTentativas("criar o contato", () =>
    chamarBolten("POST", `/contact/api/v1/${BOLTEN_CONTATOS_ID}/contacts`, {
      attributes: { Nome: respostas["Nome"], Telefone: respostas["Telefone"], "E-mail": respostas["E-mail"] },
    })
  );
  progresso.contato = contato.id;
  const oportunidade = await comTentativas("criar a oportunidade", () =>
    chamarBolten("POST", `/kanban/api/v1/${BOLTEN_FUNIL_ID}/opportunities`, {
      attributes: { Status: etapa, Observação: observacao },
    })
  );
  progresso.oportunidade = oportunidade.id;
  await comTentativas("associar o contato à oportunidade", () =>
    chamarBolten("POST", `/kanban/api/v1/${BOLTEN_FUNIL_ID}/opportunities/${oportunidade.id}/contact`, {
      id: contato.id,
    })
  );
  console.log(`Lead salvo na Bolten. Contato: ${contato.id} | Oportunidade: ${oportunidade.id}`);
}

// Recebe o lead, responde na hora com a qualificação e salva na Bolten por trás.
app.post("/api/lead", (req, res) => {
  const lista = req.body.respostas;
  if (!Array.isArray(lista)) {
    return res.status(400).json({ ok: false });
  }
  console.log("Novo lead recebido:", lista);

  // Respostas de várias opções viram texto separado por vírgula
  const respostas = {};
  for (const item of lista) {
    respostas[item.id] = Array.isArray(item.resposta) ? item.resposta.join(", ") : item.resposta;
  }

  const qualificado = !Object.keys(DESQUALIFICA).some((id) => respostas[id] === DESQUALIFICA[id]);
  const observacao = [
    qualificado ? "QUALIFICADO" : "NÃO QUALIFICADO",
    ...lista.map((item) => `${item.pergunta}: ${respostas[item.id]}`),
  ].join("\n");

  res.json({ ok: true, qualificado });

  const progresso = {};
  const etapa = qualificado ? BOLTEN_ETAPA : BOLTEN_ETAPA_DESQUALIFICADO;
  salvarNaBolten(respostas, observacao, etapa, progresso).catch(() => {
    // Esgotou as tentativas: deixa tudo no terminal para cadastrar à mão
    const jaCriado = [
      progresso.contato && `contato ${progresso.contato}`,
      progresso.oportunidade && `oportunidade ${progresso.oportunidade}`,
    ].filter(Boolean);
    const aviso = jaCriado.length ? ` (já criado na Bolten: ${jaCriado.join(", ")})` : "";
    console.error(`LEAD NÃO SALVO NA BOLTEN${aviso}. Cadastre à mão:\n${observacao}`);
  });
});

app.listen(PORTA, () => {
  console.log(`Formulário rodando em http://localhost:${PORTA}`);
});
