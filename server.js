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

// Recebe o lead e cria contato + oportunidade na Bolten.
// As respostas vão para os dois; a Bolten guarda só os campos com o mesmo nome.
// A oportunidade entra na etapa definida em BOLTEN_ETAPA.
app.post("/api/lead", async (req, res) => {
  const respostas = req.body;
  console.log("Novo lead recebido:", respostas);

  try {
    const contato = await chamarBolten("POST", `/contact/api/v1/${BOLTEN_CONTATOS_ID}/contacts`, {
      attributes: respostas,
    });
    const oportunidade = await chamarBolten("POST", `/kanban/api/v1/${BOLTEN_FUNIL_ID}/opportunities`, {
      attributes: { ...respostas, Status: BOLTEN_ETAPA },
    });
    await chamarBolten(
      "POST",
      `/kanban/api/v1/${BOLTEN_FUNIL_ID}/opportunities/${oportunidade.id}/contact`,
      { id: contato.id }
    );

    console.log(`Lead salvo na Bolten. Contato: ${contato.id} | Oportunidade: ${oportunidade.id}`);
    res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao salvar na Bolten:", erro.message);
    res.status(502).json({ ok: false });
  }
});

app.listen(PORTA, () => {
  console.log(`Formulário rodando em http://localhost:${PORTA}`);
});
