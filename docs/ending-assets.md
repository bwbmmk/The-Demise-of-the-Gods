# 0.15 终幕素材说明

三幅图片由内置 imagegen 生成，无外部参考图。原 PNG 保留在 `assets/ending/`，游戏嵌入同名 JPEG（质量 88，仅格式转换）。使用 imagegen 技能；生成模式为 text-to-image，非编辑既有美术。

| 文件 | 用途 | 状态 |
|---|---|---|
| gate.png / gate.jpg | 开门后最终战远景，压暗下半幅以保留攻击辨识度 | 已接入 |
| transfer.png / transfer.jpg | 王主动交付权柄 | 已接入共享剧情分镜 |
| embers.png / embers.jpg | 烬散为余火，分权万家 | 已接入共享剧情分镜 |
| epilogue.webm | 两幅插画的推镜、粒子与交叉淡入淡出，1280×720、18 秒 | 已离线打包；无独立语音轨，播放时沿用游戏配乐 |

短片由 `tools/render-ending-film.mjs` 制作，是插画运镜，不是模型生成的连续人物表演。原创终战音乐由 `src/music.js` 合成，三阶段 96/106/116 BPM，结尾 64 BPM。实际扬声器听感仍需用户验收。

可选朗读采用浏览器提供的中文语音，读取创作者当前正文；没有中文声音时禁用，不冒充角色配音。已通过 plugin-management 查找并建议连接 Runway，但尚未连接，未生成角色配音或模型动态视频。能力资料：[Runway 语音生成](https://help.runwayml.com/hc/en-us/articles/23859696734611-Generating-speech-from-text)、[视频生成](https://help.runwayml.com/hc/en-us/articles/37425232841875-Getting-Started-with-Generative-Video)。

## 原始生成提示词

### embers

Use case: illustration-story. Create one widescreen 16:9 cinematic ending illustration for the Chinese dark fantasy game Requiem of Gods. A lone young adult traveler in a weathered dark red scarf and charcoal cloak stands with his back to us at the threshold of a gigantic broken stone gate. His silhouette is gradually dissolving into thousands of fine warm gold embers, carried outward across a cold blue valley into the small windows and greenhouses of a human village. He has chosen to give power to ordinary households rather than become another sun god. Monumental scale, sorrow and quiet hope, no triumphant superhero pose. Painterly textured 2D storybook concept art, very restrained desaturated teal-black, antique gold, ash grey. Strong readable silhouettes compatible with a minimalist illustrated game. Houses and warm points below, huge open sky above, meaningful subtle human details. No text, no lettering, no logos, no UI. Fully opaque background.

### transfer

Use case illustration-story. Widescreen 16:9 cinematic dark fantasy game ending illustration. An exhausted aging human king in cracked black bronze armor, a broken tall crown and a heavy worn gold cloak kneels on ONE knee but holds his own posture with stubborn dignity. He opens his gloved palm willingly, giving a small brilliant golden flame to a young adult traveler wearing a weathered dark red scarf and charcoal cloak. The traveler is listening seriously, NOT triumphant. Huge open ruined stone gate behind them, cold teal-grey mountain night; a ruined throne far behind king. Painterly high quality 2D concept art, restrained antique gold and charcoal colors, strong quiet silhouettes, intimate exchange within monumental architecture. This is a sovereign's conscious relinquishment of power after defeat, not theft or execution. King at right, traveler at left, faces in profile, light between palms. No text no lettering no logos no UI.

### gate

Use case stylized-concept. Asset type 16:9 widescreen background matte painting for a side scrolling dark fantasy final boss arena. A titanic open broken stone gate and colossal weathered ribs of a dead god loom in the far distance over ruined human towers. A shattered sun halo hangs in a teal charcoal night sky, fractured gold light pours through storm clouds. Epic and mournful, painterly textured 2D concept art matching antique-gold dark-fantasy storybook illustrations. No people, no foreground characters, no weapons, no text, no logos. Composition: architecture and the distant gate concentrated in upper center-right; broad low-contrast dark space in lower quarter reserved for a separately drawn gameplay floor and characters. Atmospheric perspective, crisp monumental distant silhouettes but subdued contrast in lower half. Strong dark blue and muted old gold palette, no bright white spots that obscure small amber/red attack indicators. The world has no ordinary daylight.

原始生成文件均保留于 `C:/Users/MR/.codex/generated_images/01a10240-2875-7011-ad42-99f8e690c265/`：embers 为 `exec-f2006997-aedb-4bf3-a7cc-188dce68ddf7.png`，transfer 为 `exec-080943f0-b92c-4dbe-b803-b5e4ad727e99.png`，gate 为 `exec-662cc51b-1e7c-4231-8ce4-ff108d262494.png`。
