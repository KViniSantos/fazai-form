# Refinamento do formulário de pré-cadastro — Design

## Objetivo

Refinar o formulário existente sem alterar sua arquitetura ou identidade visual. A mudança deve reduzir atrito no preenchimento, exibir erros junto aos campos correspondentes, acelerar o endereço com ViaCEP, reforçar a experiência mobile e diagnosticar a falha 502 no envio do código de confirmação.

## Direção visual

O produto continuará usando a linguagem atual do FazAí: fundo claro, cartões brancos, vermelho como cor de ação e tipografia sem serifa. O refinamento ajustará escala tipográfica, pesos, largura de leitura, espaçamento vertical, contraste de textos auxiliares, estados de foco e erro e consistência entre controles.

No desktop, o conteúdo continuará centralizado e compacto. No mobile, os campos serão organizados em uma coluna, os cartões usarão melhor a largura disponível, o cabeçalho e o progresso ocuparão menos altura e os botões terão áreas de toque confortáveis. Nenhum novo padrão visual ou biblioteca de componentes será introduzido.

## Dados do prestador

O campo separado `Telefone` será removido da interface. Haverá apenas um campo obrigatório chamado `WhatsApp do seu serviço`, com máscara brasileira e texto auxiliar explicando que esse será o número de contato exibido aos clientes.

Para preservar o contrato atual do backend, o valor do WhatsApp será serializado tanto como `telefone` do perfil quanto como `whatsapp`. Não será criado outro campo ou coluna no banco.

CPF/CNPJ permanecerá opcional. Quando o usuário escolher um tipo e preencher o documento, a validação usará tamanho e dígitos verificadores reais. Documento vazio será aceito. Documento inválido exibirá a mensagem abaixo do input, com borda e estado acessível de erro. A navegação da etapa será impedida até a correção, sem depender do aviso geral no topo.

## Endereço e ViaCEP

O endereço continuará opcional. O CEP terá máscara `00000-000` e, ao alcançar oito dígitos, iniciará uma consulta a `https://viacep.com.br/ws/{cep}/json/`. Uma resposta válida preencherá rua e bairro sem sobrescrever o número ou complemento digitados pelo usuário.

CEPs de qualquer cidade serão aceitos, conforme decidido. A plataforma continuará deixando claro apenas que o serviço será oferecido em Fortaleza/CE. CEP inexistente, resposta inválida, falha de rede ou indisponibilidade do ViaCEP produzirão mensagem abaixo do campo CEP e manterão os campos editáveis para preenchimento manual. A consulta terá estado de carregamento discreto e não bloqueará permanentemente a etapa.

## Dados do serviço

A frase `O foco desta etapa é uma única cidade.` será removida. O bloco exibirá somente `Atendimento em Fortaleza/CE`.

A descrição manterá os limites existentes de 100 a 2.000 caracteres e exibirá contador `quantidade atual/2.000`. Antes de 100 caracteres, o contador indicará de forma discreta quanto falta; ao tentar avançar, a mensagem de validação aparecerá abaixo da descrição.

Os inputs de preço mínimo e máximo terão a mesma altura, padding e alinhamento. O comportamento atual de preço será preservado: preço mínimo obrigatório apenas quando o tipo não for `A combinar`, e preço máximo opcional, mas nunca inferior ao mínimo.

## Validação e mensagens de erro

As validações continuarão centralizadas no domínio, mas seus resultados serão convertidos em um mapa por caminho de campo. `ProfileStep` e `ServiceDetailsStep` receberão apenas os erros de seus próprios campos e os apresentarão por meio de `FormField`.

Cada controle inválido receberá `aria-invalid` e `aria-describedby`. O componente `FormField` continuará responsável por renderizar a mensagem abaixo do input. O aviso geral superior será usado apenas para problemas que não pertencem a um campo específico, como falha de catálogo, rede, autenticação, upload ou servidor.

## Envio do código e erro 502

O frontend continuará usando `supabase.auth.signInWithOtp` e não criará um segundo mecanismo de autenticação. A evidência atual mostra que a Edge Function `send-auth-email` está ativa no projeto e o texto `Unexpected status code returned from hook: 502` indica que o Auth Hook falhou ao processar a solicitação.

A investigação seguirá o fluxo Supabase Auth → Send Email Hook → função `send-auth-email` → Brevo. Serão verificados os logs da invocação, os segredos exigidos pela função, a resposta do Brevo e o formato/status retornado ao Supabase Auth. A correção será feita no componente que efetivamente falhou, preservando o hook existente. No frontend, mensagens técnicas desse tipo serão traduzidas para uma orientação curta ao usuário, sem esconder detalhes dos logs de diagnóstico.

## Arquitetura e limites

As mudanças reutilizarão os tipos, reducer, validações, repositório Supabase, Storage e componentes já existentes. Um pequeno cliente ViaCEP isolará a chamada HTTP e facilitará testes. Não serão adicionadas dependências para máscara, validação de documento ou consulta de CEP.

A migration existente será ajustada apenas se necessário para validar CPF/CNPJ também no servidor e para aceitar o WhatsApp como telefone do perfil. Não haverá novas tabelas, novos serviços de e-mail nem alteração no fluxo administrativo.

## Testes e critérios de aceite

Os testes automatizados cobrirão:

- CPF e CNPJ válidos, inválidos e vazios;
- exibição do erro diretamente abaixo do documento;
- presença de somente um input de contato telefônico;
- serialização do WhatsApp para `telefone` e `whatsapp`;
- máscara e consulta de CEP, preenchimento automático e fallback manual;
- aceite de CEP fora de Fortaleza;
- contador e erros locais da descrição;
- consistência estrutural dos dois inputs de preço;
- remoção do texto solicitado;
- tradução do erro técnico do Auth Hook;
- layout em larguras mobile por regras CSS e inspeção manual.

O fluxo será considerado concluído quando lint, testes e build passarem, o envio de OTP não retornar 502 em um teste real e um pré-cadastro puder chegar ao estado pendente com imagens e bloqueio preservados.
