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

// Recebe o lead e cria contato + oportunidade na Bolten.
// O contato recebe Nome, Telefone e E-mail. A oportunidade entra na etapa
// definida em BOLTEN_ETAPA, com a qualificação e todas as respostas na Observação.
app.post("/api/lead", async (req, res) => {
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

  try {
    const contato = await chamarBolten("POST", `/contact/api/v1/${BOLTEN_CONTATOS_ID}/contacts`, {
      attributes: { Nome: respostas["Nome"], Telefone: respostas["Telefone"], "E-mail": respostas["E-mail"] },
    });
    const oportunidade = await chamarBolten("POST", `/kanban/api/v1/${BOLTEN_FUNIL_ID}/opportunities`, {
      attributes: { Status: BOLTEN_ETAPA, Observação: observacao },
    });
    await chamarBolten(
      "POST",
      `/kanban/api/v1/${BOLTEN_FUNIL_ID}/opportunities/${oportunidade.id}/contact`,
      { id: contato.id }
    );

    console.log(`Lead salvo na Bolten. Contato: ${contato.id} | Oportunidade: ${oportunidade.id}`);
    res.json({ ok: true, qualificado });
  } catch (erro) {
    console.error("Erro ao salvar na Bolten:", erro.message);
    res.status(502).json({ ok: false });
  }
});

app.listen(PORTA, () => {
  console.log(`Formulário rodando em http://localhost:${PORTA}`);
});
