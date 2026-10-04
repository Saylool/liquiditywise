import type { Locale } from "./locales";

/*
 * The words beside a hook's permissions for what can be checked about it from
 * outside: whether its source code is verified, and how many v4 pools name it
 * (advisor/hookCheck.ts). Shown on the hooks directory under every hook, and
 * on a v4 pool's page under its hook.
 *
 * Three states for the source code and no fourth: verified on one verifier or
 * both, found on neither, or not known just now. "Not known" is never folded
 * into "not found" — a verifier that did not answer has not said anything.
 *
 * **"Verified" never stands alone.** Every page that says it also says what it
 * means — that the published code compiles to what is deployed, so it can be
 * read — and what it does not: that it is no audit and no statement that the
 * hook is safe. A reader who takes "verified" for "vetted" has been told
 * something this application has not checked and could not.
 *
 * A contract's name is shown as what its published source calls it, because
 * that is all it is: a word its author chose. Nothing here passes it off as
 * the hook's identity, which is still its address.
 *
 * Counts and dates are figures beside a label, never inside a sentence, so no
 * count is followed by a noun that would have to agree with it; the names of
 * the two verifiers are not translated, and arrive already listed in the
 * reader's own words ("Sourcify and Blockscout"). Every other term is the one
 * the rest of the site uses in that language for a hook, a pool, a network
 * and the week's busiest pools.
 */

export type HookCheckCopy = {
  /** Over the block, as "What it is permitted to do" is over the permissions. */
  readonly heading: string;
  /** On the directory, beside its introduction: what is asked, of whom, about which pools. */
  readonly directoryIntro: string;
  /** What verified source means, and that it is not an audit and not safety. Said once on every page that says "verified". */
  readonly meaning: string;
  /** Verified on the given verifiers, already listed. */
  readonly verified: (sources: string) => string;
  /** The contract's name in its published source. */
  readonly named: (name: string) => string;
  /** Neither verifier holds verified source for it. */
  readonly unverified: string;
  /** Not known just now: a verifier did not answer, or not in time. */
  readonly unchecked: string;
  /** Blockscout reads it as a proxy; the name of the code behind it where known. */
  readonly proxy: (implementation: string | null) => string;
  /** Before the links to each verifier's own page for it. */
  readonly readOn: string;
  readonly poolsLabel: string;
  /** Under the count: every pool, not the week's, counted up to the cap. */
  readonly poolsNote: (cap: string) => string;
  readonly firstLabel: string;
  readonly poolsUnchecked: string;
  /** While the line is still being asked. */
  readonly pending: string;
};

const COPY: Record<Locale, HookCheckCopy> = {
  en: {
    heading: "What can be checked about it",
    directoryIntro:
      "Beside its permissions, each hook carries two things anyone can check from outside: whether its source code is published and verified — asked of Sourcify and of the network's own Blockscout — and how many v4 pools on this network name it, every one of them rather than only this week's busiest.",
    meaning:
      "Verified source code means the code published for an address compiles to exactly what is deployed there, so anyone can read what the contract does. It is not an audit, and it is not a statement that the hook is safe: a verified hook may do everything its permissions allow, and the name in its source is whatever its author chose.",
    verified: (sources) => `Source code verified on ${sources}.`,
    named: (name) => `Its published source names the contract ${name}.`,
    unverified: "No verified source code was found on Sourcify or on Blockscout. Other explorers were not asked.",
    unchecked: "Whether its source code is verified could not be checked just now.",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout reads this address as a proxy: the code that runs is kept at another address. A verified proxy says nothing about that code, and a proxy can often be pointed at new code."
        : `Blockscout reads this address as a proxy: the code that runs is kept at another address, under the name ${implementation}. A verified proxy says nothing about that code, and a proxy can often be pointed at new code.`,
    readOn: "Read the source on:",
    poolsLabel: "v4 pools on this network that name it",
    poolsNote: (cap) => `All of them, not only this week's busiest; counted up to ${cap}.`,
    firstLabel: "The first of them created",
    poolsUnchecked: "How many v4 pools on this network name it could not be counted just now.",
    pending: "Checking its source code and the pools that name it…",
  },
  tr: {
    heading: "Dışarıdan doğrulanabilenler",
    directoryIntro:
      "İzinlerinin yanında her hook için herkesin dışarıdan bakabileceği iki şey daha var: kaynak kodunun yayımlanıp doğrulanmış olup olmadığı — Sourcify'a ve ağın kendi Blockscout'una sorulur — ve bu ağda kaç v4 havuzunun onun adını verdiği; yalnızca bu haftanın en yoğunları değil, hepsi.",
    meaning:
      "Doğrulanmış kaynak kodu, bir adres için yayımlanan kodun orada dağıtılmış olanla birebir aynı koda derlendiği anlamına gelir; böylece sözleşmenin ne yaptığını herkes okuyabilir. Bu bir denetim değildir ve hook'un güvenli olduğu anlamına da gelmez: doğrulanmış bir hook da izinlerinin verdiği her şeyi yapabilir, ve kaynağındaki ad yazarının seçtiği addır.",
    verified: (sources) => `Kaynak kodu ${sources} üzerinde doğrulanmış.`,
    named: (name) => `Yayımlanan kaynağında sözleşmenin adı ${name}.`,
    unverified: "Ne Sourcify'da ne de Blockscout'ta doğrulanmış bir kaynak kodu bulundu. Başka blok gezginlerine sorulmadı.",
    unchecked: "Kaynak kodunun doğrulanmış olup olmadığına şu anda bakılamadı.",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout bu adresi bir proxy olarak okuyor: çalışan kod başka bir adreste duruyor. Bir proxy'nin doğrulanmış olması o kod hakkında hiçbir şey söylemez, ve bir proxy çoğu zaman yeni bir koda yönlendirilebilir."
        : `Blockscout bu adresi bir proxy olarak okuyor: çalışan kod başka bir adreste, ${implementation} adıyla duruyor. Bir proxy'nin doğrulanmış olması o kod hakkında hiçbir şey söylemez, ve bir proxy çoğu zaman yeni bir koda yönlendirilebilir.`,
    readOn: "Kaynağı okuyun:",
    poolsLabel: "Bu ağda onun adını veren v4 havuzları",
    poolsNote: (cap) => `Yalnızca bu haftanın en yoğunları değil, hepsi; en fazla ${cap} tanesi sayılır.`,
    firstLabel: "İlkinin oluşturulduğu gün",
    poolsUnchecked: "Bu ağda kaç v4 havuzunun onun adını verdiği şu anda sayılamadı.",
    pending: "Kaynak kodu ve onun adını veren havuzlar kontrol ediliyor…",
  },
  de: {
    heading: "Was sich von außen prüfen lässt",
    directoryIntro:
      "Neben seinen Rechten trägt jeder Hook zwei Dinge, die jeder von außen prüfen kann: ob sein Quellcode veröffentlicht und verifiziert ist — gefragt werden Sourcify und das Blockscout des Netzwerks — und wie viele v4-Pools in diesem Netzwerk ihn nennen, und zwar alle, nicht nur die meistgehandelten dieser Woche.",
    meaning:
      "Verifizierter Quellcode heißt: Der für eine Adresse veröffentlichte Code kompiliert genau zu dem, was dort deployt ist, sodass jeder lesen kann, was der Vertrag tut. Das ist kein Audit und keine Aussage, dass der Hook sicher ist: Auch ein verifizierter Hook darf alles tun, was seine Rechte erlauben, und der Name in seinem Quellcode ist der, den sein Autor gewählt hat.",
    verified: (sources) => `Quellcode verifiziert auf ${sources}.`,
    named: (name) => `Sein veröffentlichter Quellcode nennt den Vertrag ${name}.`,
    unverified: "Weder auf Sourcify noch auf Blockscout wurde verifizierter Quellcode gefunden. Andere Explorer wurden nicht gefragt.",
    unchecked: "Ob sein Quellcode verifiziert ist, ließ sich gerade nicht prüfen.",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout liest diese Adresse als Proxy: Der Code, der läuft, liegt an einer anderen Adresse. Ein verifizierter Proxy sagt nichts über diesen Code, und ein Proxy lässt sich oft auf neuen Code umstellen."
        : `Blockscout liest diese Adresse als Proxy: Der Code, der läuft, liegt an einer anderen Adresse, unter dem Namen ${implementation}. Ein verifizierter Proxy sagt nichts über diesen Code, und ein Proxy lässt sich oft auf neuen Code umstellen.`,
    readOn: "Quellcode lesen auf:",
    poolsLabel: "v4-Pools in diesem Netzwerk, die ihn nennen",
    poolsNote: (cap) => `Alle, nicht nur die meistgehandelten dieser Woche; gezählt bis ${cap}.`,
    firstLabel: "Der erste davon angelegt am",
    poolsUnchecked: "Wie viele v4-Pools in diesem Netzwerk ihn nennen, ließ sich gerade nicht zählen.",
    pending: "Quellcode und die Pools, die ihn nennen, werden geprüft…",
  },
  es: {
    heading: "Lo que se puede comprobar desde fuera",
    directoryIntro:
      "Junto a sus permisos, cada hook lleva dos cosas que cualquiera puede comprobar desde fuera: si su código fuente está publicado y verificado — se pregunta a Sourcify y al Blockscout de la propia red — y cuántos pools v4 de esta red lo nombran, todos ellos y no solo los más activos de esta semana.",
    meaning:
      "Código fuente verificado significa que el código publicado para una dirección compila exactamente a lo que está desplegado allí, así que cualquiera puede leer lo que hace el contrato. No es una auditoría ni una afirmación de que el hook sea seguro: un hook verificado puede hacer todo lo que sus permisos le permiten, y el nombre en su código es el que eligió su autor.",
    verified: (sources) => `Código fuente verificado en ${sources}.`,
    named: (name) => `Su código publicado llama al contrato ${name}.`,
    unverified: "No se encontró código fuente verificado ni en Sourcify ni en Blockscout. No se preguntó a otros exploradores.",
    unchecked: "No se pudo comprobar en este momento si su código fuente está verificado.",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout lee esta dirección como un proxy: el código que se ejecuta está en otra dirección. Un proxy verificado no dice nada de ese código, y a menudo un proxy puede apuntarse a código nuevo."
        : `Blockscout lee esta dirección como un proxy: el código que se ejecuta está en otra dirección, con el nombre ${implementation}. Un proxy verificado no dice nada de ese código, y a menudo un proxy puede apuntarse a código nuevo.`,
    readOn: "Leer el código en:",
    poolsLabel: "Pools v4 de esta red que lo nombran",
    poolsNote: (cap) => `Todos, no solo los más activos de esta semana; contados hasta ${cap}.`,
    firstLabel: "El primero de ellos, creado el",
    poolsUnchecked: "No se pudo contar en este momento cuántos pools v4 de esta red lo nombran.",
    pending: "Comprobando su código fuente y los pools que lo nombran…",
  },
  ar: {
    heading: "ما يمكن التحقق منه من الخارج",
    directoryIntro:
      "إلى جانب صلاحياته، يحمل كل خطّاف أمرين يستطيع أي أحد التحقق منهما من الخارج: هل شيفرته المصدرية منشورة وموثّقة — ويُسأل عن ذلك Sourcify ومستكشف Blockscout الخاص بالشبكة — وكم تجمّعًا من تجمّعات v4 على هذه الشبكة يسمّيه، كلها لا الأكثر نشاطًا هذا الأسبوع وحدها.",
    meaning:
      "الشيفرة المصدرية الموثّقة تعني أن الشيفرة التي نُشرت لعنوانٍ ما تُترجَم بالضبط إلى العقد المنشور فعلًا عند ذلك العنوان، فيستطيع أي أحد أن يقرأ ما يفعله العقد. وهذا ليس تدقيقًا، وليس قولًا بأن الخطّاف آمن: فالخطّاف الموثّق قد يفعل كل ما تسمح به صلاحياته، والاسم الذي في شيفرته هو ما اختاره كاتبها.",
    verified: (sources) => `الشيفرة المصدرية موثّقة على ${sources}.`,
    named: (name) => `تسمّي شيفرته المنشورة العقدَ ${name}.`,
    unverified: "لم يُعثر على شيفرة مصدرية موثّقة لا على Sourcify ولا على Blockscout. ولم تُسأل مستكشفات أخرى.",
    unchecked: "تعذّر الآن التحقق مما إذا كانت شيفرته المصدرية موثّقة.",
    proxy: (implementation) =>
      implementation === null
        ? "يقرأ Blockscout هذا العنوان على أنه وكيل (proxy): الشيفرة التي تعمل محفوظة عند عنوان آخر. والوكيل الموثّق لا يقول شيئًا عن تلك الشيفرة، وكثيرًا ما يمكن توجيه الوكيل إلى شيفرة جديدة."
        : `يقرأ Blockscout هذا العنوان على أنه وكيل (proxy): الشيفرة التي تعمل محفوظة عند عنوان آخر، باسم ${implementation}. والوكيل الموثّق لا يقول شيئًا عن تلك الشيفرة، وكثيرًا ما يمكن توجيه الوكيل إلى شيفرة جديدة.`,
    readOn: "اقرأ الشيفرة على:",
    poolsLabel: "تجمّعات v4 على هذه الشبكة التي تسمّيه",
    poolsNote: (cap) => `كلها، لا الأكثر نشاطًا هذا الأسبوع وحدها؛ ويتوقف العدّ عند ${cap}.`,
    firstLabel: "تاريخ إنشاء أولها",
    poolsUnchecked: "تعذّر الآن عدّ تجمّعات v4 على هذه الشبكة التي تسمّيه.",
    pending: "يجري التحقق من شيفرته المصدرية ومن التجمّعات التي تسمّيه…",
  },
  hi: {
    heading: "बाहर से क्या जाँचा जा सकता है",
    directoryIntro:
      "अनुमतियों के साथ, हर hook के बारे में दो बातें ऐसी हैं जिन्हें कोई भी बाहर से जाँच सकता है: क्या उसका सोर्स कोड प्रकाशित और सत्यापित है — यह Sourcify और नेटवर्क के अपने Blockscout से पूछा जाता है — और इस नेटवर्क पर कितने v4 पूल उसका नाम लेते हैं, सिर्फ़ इस हफ़्ते के सबसे व्यस्त नहीं, सभी।",
    meaning:
      "सत्यापित सोर्स कोड का मतलब है कि किसी पते के लिए प्रकाशित कोड कंपाइल होकर ठीक वही बनता है जो उस पते पर तैनात है, इसलिए कोई भी पढ़ सकता है कि कॉन्ट्रैक्ट क्या करता है। यह ऑडिट नहीं है, और यह कहना भी नहीं कि hook सुरक्षित है: सत्यापित hook भी वह सब कर सकता है जिसकी उसकी अनुमतियाँ छूट देती हैं, और उसके कोड में लिखा नाम वही है जो उसके लेखक ने चुना।",
    verified: (sources) => `सोर्स कोड ${sources} पर सत्यापित है।`,
    named: (name) => `उसका प्रकाशित सोर्स कोड कॉन्ट्रैक्ट को ${name} नाम देता है।`,
    unverified: "न Sourcify पर और न Blockscout पर कोई सत्यापित सोर्स कोड मिला। दूसरे एक्सप्लोरर से नहीं पूछा गया।",
    unchecked: "उसका सोर्स कोड सत्यापित है या नहीं, यह अभी जाँचा नहीं जा सका।",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout इस पते को proxy के रूप में पढ़ता है: जो कोड चलता है वह किसी दूसरे पते पर रखा है। सत्यापित proxy उस कोड के बारे में कुछ नहीं बताता, और proxy को अक्सर नए कोड की ओर मोड़ा जा सकता है।"
        : `Blockscout इस पते को proxy के रूप में पढ़ता है: जो कोड चलता है वह किसी दूसरे पते पर, ${implementation} नाम से, रखा है। सत्यापित proxy उस कोड के बारे में कुछ नहीं बताता, और proxy को अक्सर नए कोड की ओर मोड़ा जा सकता है।`,
    readOn: "सोर्स कोड यहाँ पढ़ें:",
    poolsLabel: "इस नेटवर्क पर उसका नाम लेने वाले v4 पूल",
    poolsNote: (cap) => `सिर्फ़ इस हफ़्ते के सबसे व्यस्त नहीं, सभी; ${cap} तक गिने जाते हैं।`,
    firstLabel: "उनमें से पहला बना",
    poolsUnchecked: "इस नेटवर्क पर कितने v4 पूल उसका नाम लेते हैं, यह अभी गिना नहीं जा सका।",
    pending: "उसका सोर्स कोड और उसका नाम लेने वाले पूल जाँचे जा रहे हैं…",
  },
  zh: {
    heading: "从外部可以核实的",
    directoryIntro:
      "除了权限，每个 hook 还附有两项任何人都能从外部核实的信息：它的源代码是否已公开并经过验证——向 Sourcify 和该网络自己的 Blockscout 查询——以及这个网络上有多少个 v4 资金池指定了它，统计的是全部，而不只是本周最活跃的那些。",
    meaning:
      "源代码经过验证，意思是为某个地址公开的代码编译后与部署在该地址上的内容完全一致，因此任何人都能读到这份合约做了什么。这不是审计，也不代表这个 hook 是安全的：经过验证的 hook 同样可以做它的权限允许的一切，而源代码里的名字只是作者自己起的。",
    verified: (sources) => `源代码已在 ${sources} 上验证。`,
    named: (name) => `它公开的源代码把这份合约命名为 ${name}。`,
    unverified: "在 Sourcify 和 Blockscout 上都没有找到经过验证的源代码。没有查询其他区块浏览器。",
    unchecked: "暂时无法核实它的源代码是否经过验证。",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout 将这个地址识别为代理合约：实际运行的代码位于另一个地址。代理合约经过验证，并不能说明那份代码的任何情况，而且代理合约往往可以被指向新的代码。"
        : `Blockscout 将这个地址识别为代理合约：实际运行的代码位于另一个地址，名为 ${implementation}。代理合约经过验证，并不能说明那份代码的任何情况，而且代理合约往往可以被指向新的代码。`,
    readOn: "在以下网站阅读源代码：",
    poolsLabel: "这个网络上指定了它的 v4 资金池",
    poolsNote: (cap) => `统计全部，而不只是本周最活跃的那些；计数上限为 ${cap}。`,
    firstLabel: "其中第一个的创建日期",
    poolsUnchecked: "暂时无法统计这个网络上有多少个 v4 资金池指定了它。",
    pending: "正在核实它的源代码以及指定它的资金池……",
  },
  ru: {
    heading: "Что можно проверить снаружи",
    directoryIntro:
      "Помимо разрешений, у каждого hook’а есть две вещи, которые любой может проверить снаружи: опубликован ли и верифицирован его исходный код — об этом спрашиваются Sourcify и собственный Blockscout сети, — и сколько пулов v4 в этой сети его называют, причём все, а не только самые оживлённые этой недели.",
    meaning:
      "Верифицированный исходный код означает, что код, опубликованный для адреса, компилируется ровно в то, что развёрнуто по этому адресу, так что любой может прочитать, что делает контракт. Это не аудит и не утверждение, что hook безопасен: верифицированный hook может делать всё, что позволяют его разрешения, а имя в его исходном коде — то, которое выбрал его автор.",
    verified: (sources) => `Исходный код верифицирован на ${sources}.`,
    named: (name) => `В его опубликованном исходном коде контракт называется ${name}.`,
    unverified: "Ни на Sourcify, ни на Blockscout верифицированный исходный код не найден. Другие обозреватели не опрашивались.",
    unchecked: "Верифицирован ли его исходный код, сейчас проверить не удалось.",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout читает этот адрес как прокси: выполняемый код хранится по другому адресу. Верифицированный прокси ничего не говорит об этом коде, а прокси часто можно перенаправить на новый код."
        : `Blockscout читает этот адрес как прокси: выполняемый код хранится по другому адресу, под именем ${implementation}. Верифицированный прокси ничего не говорит об этом коде, а прокси часто можно перенаправить на новый код.`,
    readOn: "Читать исходный код на:",
    poolsLabel: "Пулы v4 в этой сети, которые его называют",
    poolsNote: (cap) => `Все, а не только самые оживлённые этой недели; счёт идёт до ${cap}.`,
    firstLabel: "Первый из них создан",
    poolsUnchecked: "Сколько пулов v4 в этой сети его называют, сейчас сосчитать не удалось.",
    pending: "Проверяем исходный код и пулы, которые его называют…",
  },
  pt: {
    heading: "O que dá para conferir de fora",
    directoryIntro:
      "Ao lado das permissões, cada hook traz duas coisas que qualquer um pode conferir de fora: se o código-fonte dele está publicado e verificado — a pergunta vai ao Sourcify e ao Blockscout da própria rede — e quantos pools v4 desta rede citam esse hook, todos eles e não só os mais movimentados desta semana.",
    meaning:
      "Código-fonte verificado quer dizer que o código publicado para um endereço compila exatamente para o que está implantado ali, então qualquer um pode ler o que o contrato faz. Não é uma auditoria nem uma afirmação de que o hook é seguro: um hook verificado pode fazer tudo o que as permissões dele permitem, e o nome no código dele é o que o autor escolheu.",
    verified: (sources) => `Código-fonte verificado em ${sources}.`,
    named: (name) => `O código publicado dele chama o contrato de ${name}.`,
    unverified: "Nenhum código-fonte verificado foi encontrado no Sourcify nem no Blockscout. Outros exploradores não foram consultados.",
    unchecked: "Não foi possível conferir agora se o código-fonte dele está verificado.",
    proxy: (implementation) =>
      implementation === null
        ? "O Blockscout lê este endereço como um proxy: o código que roda fica em outro endereço. Um proxy verificado não diz nada sobre esse código, e muitas vezes um proxy pode ser apontado para um código novo."
        : `O Blockscout lê este endereço como um proxy: o código que roda fica em outro endereço, com o nome ${implementation}. Um proxy verificado não diz nada sobre esse código, e muitas vezes um proxy pode ser apontado para um código novo.`,
    readOn: "Ler o código em:",
    poolsLabel: "Pools v4 desta rede que citam esse hook",
    poolsNote: (cap) => `Todos, não só os mais movimentados desta semana; contados até ${cap}.`,
    firstLabel: "O primeiro deles, criado em",
    poolsUnchecked: "Não foi possível contar agora quantos pools v4 desta rede citam esse hook.",
    pending: "Conferindo o código-fonte e os pools que citam esse hook…",
  },
  "zh-Hant": {
    heading: "從外部可以核實的",
    directoryIntro:
      "除了權限，每個 hook 還附有兩項任何人都能從外部核實的資訊：它的原始碼是否已公開並經過驗證——向 Sourcify 和該網路自己的 Blockscout 查詢——以及這個網路上有多少個 v4 資金池指定了它，統計的是全部，而不只是本週最活躍的那些。",
    meaning:
      "原始碼經過驗證，意思是為某個地址公開的程式碼編譯後與部署在該地址上的內容完全一致，因此任何人都能讀到這份合約做了什麼。這不是審計，也不代表這個 hook 是安全的：經過驗證的 hook 同樣可以做它的權限允許的一切，而原始碼裡的名稱只是作者自己取的。",
    verified: (sources) => `原始碼已在 ${sources} 上驗證。`,
    named: (name) => `它公開的原始碼把這份合約命名為 ${name}。`,
    unverified: "在 Sourcify 和 Blockscout 上都沒有找到經過驗證的原始碼。沒有查詢其他區塊瀏覽器。",
    unchecked: "目前無法核實它的原始碼是否經過驗證。",
    proxy: (implementation) =>
      implementation === null
        ? "Blockscout 將這個地址識別為代理合約：實際執行的程式碼位於另一個地址。代理合約經過驗證，並不能說明那份程式碼的任何情況，而且代理合約往往可以被指向新的程式碼。"
        : `Blockscout 將這個地址識別為代理合約：實際執行的程式碼位於另一個地址，名為 ${implementation}。代理合約經過驗證，並不能說明那份程式碼的任何情況，而且代理合約往往可以被指向新的程式碼。`,
    readOn: "在以下網站閱讀原始碼：",
    poolsLabel: "這個網路上指定了它的 v4 資金池",
    poolsNote: (cap) => `統計全部，而不只是本週最活躍的那些；計數上限為 ${cap}。`,
    firstLabel: "其中第一個的建立日期",
    poolsUnchecked: "目前無法統計這個網路上有多少個 v4 資金池指定了它。",
    pending: "正在核實它的原始碼以及指定它的資金池……",
  },
};

export const getHookCheckCopy = (locale: Locale): HookCheckCopy => COPY[locale];
