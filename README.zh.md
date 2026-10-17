# dsh-token-breakdown-stats

[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-247bbf)](https://github.com/topics/dsh-plugin)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-%3E%3D0.2.1--rc.2-4d6bfe)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | 涓枃

涓€涓?[dsh](https://github.com/deepseek-ai/deepseek-harness) 鎻掍欢锛坄dsh-plugin`
topic锛夛細鏇挎崲杈撳叆妗嗕笅鏂圭殑缁熻鑳跺泭锛岃浼氳瘽 token 鎬婚噺瑕嗙洊**涓?Agent 鍙婂叾璋冪敤鐨勫叏閮ㄥ瓙
Agent**锛岀偣鍑诲脊鍑烘寜璁¤垂妗躲€佹寜瀛?Agent銆佹寜妯″瀷涓変釜缁村害鐨勫垎椤圭粺璁°€?

## 绠€浠?

dsh 浼氳瘽杈撳叆妗嗕笅鏂圭殑缁熻鑳跺泭鍙粺璁?*涓?Agent** 鐨?token 鐢ㄩ噺銆傚綋涓?Agent 璋冪敤瀛?
Agent 鏃讹紝瀛?Agent 娑堣€楃殑 token 鍦ㄤ細璇濆簳閮ㄥ畬鍏ㄧ湅涓嶅埌銆?

鏈彃浠舵浛鎹㈣鑳跺泭锛岃搴曢儴鏄剧ず**浼氳瘽鎬婚噺锛堜富 Agent + 瀹冭皟鐢ㄧ殑鍏ㄩ儴瀛?Agent锛?*锛岀偣鍑?
鍚庡脊鍑虹殑瀵硅瘽妗嗘寜璁¤垂妗躲€佹寜瀛?Agent銆佹寜妯″瀷涓変釜缁村害鍒嗛」缁熻銆?

## 鍙樺寲鐐?

| | 鍘熺敓鑳跺泭 | 鏈彃浠?|
|---|---|---|
| 鑳跺泭鏂囧瓧 | 涓?Agent 鎬婚噺 + 缂撳瓨鍛戒腑 | **浼氳瘽鎬婚噺**锛堜富 + 瀛愶級+ 缂撳瓨鍛戒腑 + 瀛?Agent 涓暟 |
| 瀵硅瘽妗?| 鍥涗釜璁¤垂妗?| 璁¤垂妗躲€佷富/瀛愬崰姣斻€佸瓙 Agent 姹囨€汇€佹寜妯″瀷涓€琛?|
| 鏃堕棿/娲诲姩鑳跺泭 | 杞銆佹楠ゃ€侀€熷害銆佽€楁椂 | 涓庡師鏈変竴鑷达紙鍘熸牱杩樺師锛?|

瀛?Agent 涓€寰嬩互**姹囨€?*鍛堢幇锛氳兌鍥婃樉绀轰釜鏁帮紝瀵硅瘽妗嗘姌鍙犳垚涓€鍧楋紙涓暟銆佸叾涓嚑涓粛鍦ㄨ繍琛屻€佸崰
浼氳瘽鎬婚噺姣斾緥銆佷互鍙婃姌鍙犲悗鐨勫洓涓《锛夈€備笉閫愪釜鍒楀嚭琛屸€斺€斾竴涓細璇濆彲鑳借皟璧峰嚑鍗佷釜瀛?Agent锛岃€岄€?
涓槑缁嗘湰鏉ュ氨鍦ㄤ細璇濆ご閮ㄧ殑瀛?Agent 鐩綍閲屻€?

瀵硅瘽妗嗗唴瀹癸細

- **鎬荤敤閲?* 鈥斺€?鍥涗釜浜掓枼璁¤垂妗讹紙鏈紦瀛樿緭鍏ャ€佺紦瀛樿鍙栥€佺紦瀛樺啓鍏ャ€佽緭鍑猴級涓庣紦瀛樺懡涓巼锛?
  瑕嗙洊鏁存５浼氳瘽鏍戙€?
- **涓?Agent** 鈥斺€?宸茶浇鍏ヨ疆娆¤娴嬪埌鐨?鎻愪緵鏂?妯″瀷锛屼互鍙婅浼氳瘽鑷韩鐨勫洓涓《銆?
- **瀛?Agent锛圢锛?* 鈥斺€?姹囨€诲潡锛氬叡鍑犱釜銆佸叾涓嚑涓粛鍦ㄨ繍琛屻€佸崰浼氳瘽鎬婚噺姣斾緥锛屼互鍙婃姌鍙犲悗鐨?
  鍥涗釜妗躲€?
- **鎸夋ā鍨?* 鈥斺€?鐢卞凡杞藉叆杞鎶樺彔鍑虹殑姣忎釜 鎻愪緵鏂?妯″瀷 鐢ㄩ噺銆?
- 浼氳瘽灏氭湭璋冪敤瀛?Agent 鏃舵樉绀哄弸濂芥彁绀恒€?

## 瀹炵幇鏂瑰紡

杈撳叆妗嗙粺璁?dock 鍦?DSH `0.2.1-rc.2` 閲屾敼杩囧舰鐘讹紝鎵€浠ユ彃浠舵寜鍘熺敓 `ui-chat` 瀹為檯娉ㄥ唽鐨勮鏉ュ榻愶細

| DSH | 鍘熺敓 `conversation.composer.dock` 琛?| 鏈彃浠舵敞鍐?|
|---|---|---|
| `0.2.0-rc.2` | 鍗曚釜鍗曞厓锛宨d `stats`锛宱rder 0 | 锛堝崟鍗曞厓褰㈡€?`StatsPills`锛?|
| `0.2.1-rc.2` | `activity` order 0 **涓?* `usage` order 1 | `activity` order 0 **涓?* `usage` order 1 |

list slot 鎸?**id + priority** 鎶婃敞鍐屽尮閰嶅埌鍘熺敓琛岋細鍚?id 涓?priority 鏈€浣庣殑閭ｆ潯娓叉煋锛屽洜姝ょ敤
鍘熺敓 id 閰嶄竴涓弗鏍兼洿浣庣殑 `priority` 灏辨槸**鏇挎崲**璇ユ帶浠讹紱鑰屾敞鍐屼竴涓師鐢熷寘骞朵笉浣跨敤鐨?id 鍒欐槸
**鏂板**涓€涓帶浠?鈥斺€?杩欐鏄?dock 鎷嗘垚涓よ鍚庯紝鏃х殑鍗?`stats` 琛岃〃鐜颁负鑳跺泭閲嶅鐨勫師鍥犮€?

鍥犳鏈彃浠剁殑涓や釜鍗曞厓閮戒紶 `priority: -1`锛堜綆浜庡師鐢熻榛樿鐨?0锛夛紝骞朵笖姣忎釜鍗曞厓鍙覆鏌撲竴涓兌鍥婏細

- `activity` 鈫?杞/姝ラ鏁颁笌鏁翠細璇濊緭鍑洪€熷害
- `usage` 鈫?瑕嗙洊鍏ㄩ儴瀛?Agent 鐨勪細璇?token 鎬婚噺

涓よ€呯敱鍚屼竴涓?`slots.inject` generator 娉ㄥ唽锛堜笌鍘熺敓琛屼竴鑷达級锛屽叡鐢ㄥ悓涓€涓噴鏀句綔鐢ㄥ煙锛屼笉浼氬彧鎸備笂涓€鍗娿€?

鎵€鏈夋暟瀛楅兘鏉ヨ嚜鎸佷箙鎶曞奖锛屽垎椤典笌鍘嬬缉閮戒笉浼氭敼鍙樺畠浠細

- `tokenUsage` 鈥斺€?姣忎釜浼氳瘽鍥涗釜浜掓枼鐨勬彁渚涙柟璁¤垂妗躲€?
- `subagentCatalog` 鈥斺€?浼氳瘽鐨勭洿灞炲瓙绾э紝鎸夌埗浼氳瘽浜嬩欢椤哄簭锛屽甫妯″紡涓庡彲閫夋爣绛俱€?
- `SessionSummary.projectionValues` 鈥斺€?鍚屼竴鎵规姇褰卞鍔犲瓙 Agent 韬唤锛坄label`锛変笌
  璁℃椂锛屾寜浼氳瘽 id 瀵诲潃銆?
- `ChatSnapshot.nodes.values()` 鈥斺€?keyed store 閲屾墍鏈夊凡鐗╁寲鐨?Chat Node銆?
  `turn-tail` 琛?*鏁呮剰涓?*杩?`legacy.nodes`锛屾墍浠ラ€愯疆娆＄殑 `routes`锛堟彁渚涙柟/妯″瀷锛?
  鍙兘浠庤繖閲岃锛沴egacy 鍒囩墖浠嶇劧鐢ㄤ簬姝ラ鏁版姌鍙犮€?

`compact` / `detailed` 鍋忓ソ璇诲彇涓庡師鐢熻兌鍥婄浉鍚岀殑 `ui-chat` 閰嶇疆鍩燂紱`compact` 鍙繚鐣?
閫熷害涓庣紦瀛樺懡涓殑绾枃鏈睍绀猴紝涓嶅脊瀵硅瘽妗嗐€?

## 宸茬煡闄愬埗

- **鎷夸笉鍒版瘡涓瓙 Agent 鐨勬ā鍨嬪悕銆?* 瀹㈡埛绔殑 `tokenUsage` 鎶曞奖鍙湁鍥涗釜妗讹紝娌℃湁璺敱
  淇℃伅锛屽洜姝ゅ瓙 Agent 琛屽彧鏄剧ず鐢ㄩ噺锛屼笉鏄剧ず妯″瀷銆傛ā鍨嬪綊灞炶鐩栦富浼氳瘽宸茶浇鍏ョ殑杞銆?
- **鍚庝唬鍙戠幇鏄?best-effort銆?* `subagentCatalog` 鍙槸鐩村睘瀛愮骇锛涘瓩 Agent 鍦ㄥ叾鑷韩鐩綍
  琚姞杞藉悗鎵嶄細鍑虹幇锛堜笌鍘熺敓瀛?Agent 鐩綍鍚屼竴瑙勫垯锛夈€傛湭鍔犺浇鐨勫眰绾т笉浼氬嚟绌虹敓鎴愩€?
- **妯″瀷褰掑睘鍙鐩栧凡杞藉叆杞銆?* `turn-tail` 琛屽彧瀵瑰凡杞藉叆绐楀彛鍐?*宸插叧闂?*鐨勮疆娆″瓨鍦紝
  鍥犳鍦ㄥ緢闀裤€佸垎椤电殑浼氳瘽涓婏紝妯″瀷琛屼笌鎸夋ā鍨嬩竴鑺傚彲鑳借惤鍚庝簬鎸佷箙鎬婚噺銆傝繖涓€鐗堥噷 chat 鐩爣鐨?
  assistant 鑺傜偣涓嶅甫 `providerMetadata`锛屾病鏈夌浜屼釜鏉ユ簮鍙€€鈥斺€旇嚦灏戣杞藉叆涓€涓凡鍏抽棴杞锛?
  妯″瀷琛屾墠浼氭樉绀轰細璇濈敤杩囩殑妯″瀷銆?
- **compact 妯″紡** 淇濇寔鍘熺敓琛屼负锛堜粎閫熷害涓庣紦瀛樺懡涓級銆?

## 瀹夎

bundle 灏辨槸涓€涓櫘閫氱洰褰曪紝`client.js` 宸叉彁浜わ紝鏃犻渶鏋勫缓銆傚厛浠庢湰鍦板厠闅嗗畨瑁咃細

```powershell
git clone https://github.com/Minggle/dsh-token-breakdown-stats.git
```

鐒跺悗鍦?dsh 浼氳瘽閲岀敤 `plugin_manager` 鎶?bundle 瑁呰繘 profile锛?

```
plugin_manager  action: install_bundle
               target: <鍏嬮殕鐩綍鐨勭粷瀵硅矾寰?
```

琛ヤ竵琛?id 涓?`token-breakdown-stats`銆傞噸鍚簲鐢紙鎴栫瓑 live patch 閲嶈浇鐢熸晥锛夛紝杈撳叆妗嗕笅鏂?
鐨勮兌鍥婂嵆琚浛鎹€?

鏀瑰畬婧愮爜鍚庨噸鏂扮敓鎴?`client.js`锛?

```powershell
node build.mjs
```

## 楠岃瘉

```powershell
node src/smoke.test.cjs
```

鍐掔儫娴嬭瘯閫氳繃 mock 鐨?`window.__ModuleLoader__` 鍜屼竴涓渶灏?React 杩愯鏃跺姞杞芥瀯寤轰骇鐗?
`client.js`锛屾柇瑷€姹囨€绘暟瀛︺€佽兌鍥婃枃瀛椼€佸璇濇鍚勮妭銆丒scape 鍏抽棴銆乧ompact 妯″紡浠ュ強涓嫳
璇█閿榻愩€?

## 鏂囦欢

- `index.js` 鈥斺€?Host 鍗婅竟锛堜笉闇€瑕?Host 琛岋級銆?
- `client.js` 鈥斺€?鐢熸垚鐨勬祻瑙堝櫒浜х墿锛堣鍕挎墜鏀癸級銆?
- `src/entry.js` 鈥斺€?slot 娉ㄥ唽涓?mode hook銆?
- `src/stats-pills.js` 鈥斺€?涓や釜 dock 鍗曞厓锛坄ActivityStats`銆乣UsageStats`锛夈€佷繚鐣欑殑鍚堝苟鐗?
  `StatsPills`锛屼互鍙婂垎椤圭粺璁″璇濇銆?
- `src/token-aggregator.cjs` 鈥斺€?绾仛鍚堜笌璺敱鎶樺彔銆?
- `src/smoke.test.cjs` 鈥斺€?Node 鍐掔儫娴嬭瘯銆?
- `locale/{en,zh}.json` 鈥斺€?璇█瀛楀吀锛堝敮涓€鏁版嵁婧愶級銆?
- `icon.svg` 鈥斺€?鍘熷垱鍥炬爣銆?
- `build.mjs` 鈥斺€?鎶?`src/` 鍐呰仈鎴愬崟涓?`client.js`銆?

## 鐜瑕佹眰

- DeepSeek Harness `>= 0.2.1-rc.2`锛堟彃浠惰鍙?`ChatSnapshot.nodes`銆?
  `SessionSummary.projectionValues`锛屽苟鍖归厤鎷嗗垎鍚庣殑 `conversation.composer.dock`
  琛?`activity` 涓?`usage`锛夈€俙0.2.0-rc.2` 鐨?dock 杩樻槸鍗曚釜 `stats` 鍗曞厓锛屾湰鎻掍欢
  宸蹭笉鍐嶉拡瀵瑰畠銆?
- desktop 鎴?web profile锛沇eb GUI 娓叉煋鑳跺泭銆?

## 瀹夎浜嬫晠璁板綍锛?026-10-15锛?

鏃╂湡鐗堟湰鏇捐妗岄潰鐗?web boot 澶辫触锛歚1 entry did not activate:
@deepseek-ai/dsh-client-ui-chat: failed`銆傚綋鏃剁Щ闄や簡 bundle锛屽苟浠庡簲鐢ㄨ嚜宸卞啓
鐨勫浠斤紙`cordis.patch.yml.bak-*`锛夋仮澶嶄簡 profile锛岀敤鎴锋暟鎹棤鎹熴€?

涓や釜鏍瑰洜璁板綍鍦ㄦ锛屽洜涓哄畠浠兘寰堝鏄撳啀娆″紩鍏ワ細

1. **list slot 鎷掔粷鍚?id 鍚?priority 鐨勭浜屾娉ㄥ唽銆?* 鍘熺敓 `ui-chat` 琛屼互
   priority 0 鍗犵潃 `conversation.composer.dock` 鐨?id `stats`锛屾浛鎹㈣€呭繀椤讳紶
   涓ユ牸鏇翠綆鐨?`priority`锛堟湰鎻掍欢鐢?`-1`锛夈€俿lot 鐨?`register` 浼氭姏
   `already has an entry with id "stats" at priority 0 鈥?register at a
   different priority to shadow it (lowest renders)`锛涜€屾彃浠剁殑 inject 鍥炶皟
   鏄湪 dock 灞炰富鐨?fiber 閲屾墽琛岀殑锛屾墍浠ュけ璐ヨ鍦ㄥ睘涓诲ご涓婅€屼笉鏄彃浠跺ご涓娿€?
2. **鍙楅檺 Client 涓婁笅鏂囪闂湭澹版槑 service 浼氭姏閿欍€?* 鏈湪 entry 鐨?`inject`
   閲屽０鏄?`configForms` 灏辫 `ctx.configForms`锛屼細鎶?
   `cannot get property "configForms" without inject`銆傜幇鍦ㄦ彃浠跺彧澹版槑
   `['slots', 'locale']`锛屽叾浣欎竴寰嬮槻寰″紡璇诲彇銆?

鍐掔儫娴嬭瘯閲屾湁涓や釜 mock 鍒嗗埆澶嶇幇杩欎袱绉嶅け璐ユā寮忥紝鎵€浠ュ洖褰掍細鍏堣娴嬭瘯绾紝鑰屼笉鏄?
璁?boot 宕┿€?

## 鑳跺泭閲嶅鍥炲綊锛圖SH 0.2.1-rc.2锛?026-10-17锛?

鍗囩骇鍒?DSH `0.2.1-rc.2` 鍚庯紝姣忎竴椤圭粺璁￠兘**鏄剧ず浜嗕袱閬?*銆傚師鍥犳槸 dock 褰㈢姸鍙樹簡锛岃€屼笉鏄?
slot 瑙勫垯鍙樹簡锛歚ui-chat` 鎶婂師鏉ョ殑鍗曚釜 `stats` 鍗曞厓鎷嗘垚浜?`activity`锛坥rder 0锛夊拰
`usage`锛坥rder 1锛夈€傛彃浠跺綋鏃朵粛鍙敞鍐?`stats`锛岃€屽畠宸茬粡鍖归厤涓嶅埌浠讳綍鍘熺敓琛?鈥斺€?浜庢槸鍙樻垚
**鏂板**绗笁涓帶浠讹紝鑰屼笉鏄浛鎹紝涓や釜鍘熺敓鑳跺泭灏卞湪涓嬫柟涓€璧锋覆鏌撲簡銆?

鐜板湪鎻掍欢涓€涓€瀵瑰簲鍦版敞鍐?`activity` 涓?`usage`锛屾瘡涓崟鍏冨彧娓叉煋涓€涓兌鍥?
锛坄ActivityStats` / `UsageStats`锛夛紝鍚屾椂 `entry.js` 浠嶆妸瀹冧滑鏀惧湪鍚屼竴涓?
`slots.inject` generator 閲岋紝淇濊瘉涓€璧锋寕杞姐€佷竴璧峰嵏杞姐€?

涓ら亾闃茬嚎闃叉閲嶆紨锛?

- 鍐掔儫娴嬭瘯鏀逛负妯℃嫙**鎷嗗垎鍚?*鐨?dock锛屽洜姝ゆ敞鍐屼竴涓?dock 骞朵笉浣跨敤鐨?id 浼氱洿鎺ヨ娴嬭瘯澶辫触锛?
  鑰屼笉鏄倓鎮勫鍑轰竴涓帶浠讹紱鍚屾椂鏂█姣忎釜鍗曞厓鍙覆鏌撲竴涓兌鍥婏紙涓や釜鍗曞厓閮芥覆鏌撲袱涓兌鍥婁細璁?
  鏁村潡鍐呭閲嶅涓€閬嶏級銆?
- 涓€涓?`0.2.1-rc.2` fixture 鎶婁袱濂楁敞鍐岄兘鍠傜粰**鐪熷疄鐨?*鍘熺敓 `SlotCore`锛屾柇瑷€淇鍚庢覆鏌?
  2 涓帶浠躲€佷慨澶嶅墠娓叉煋 3 涓€?

## 璁稿彲璇?

[MIT](LICENSE)
