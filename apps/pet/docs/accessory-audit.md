# 配件核验台账（accessory audit）

> 目的：咕咕全部 142 件装扮配件的佩戴位置核验记录。**规则化 ✅ 的项目不重复核验**；只在布局代码（PetSprite `accessoryLayout`）、素材文件或槽位判定变更后，复检 ⚠️/❌ 项与新增素材。

## 核验方法（两道关）

1. **程序化审计**（`tools/audit-accessories.mjs`，本地脚本不入库）：
   - ffmpeg 解码素材 alpha 包围盒 → 按 `accessoryLayout()` 推导 baby/teen/adult 三阶段的**实际渲染矩形**；
   - 槽位规则：帽子下缘不得过眼线（adult 眼线 22%）、围巾上缘不得盖喙、眼镜中心贴眼线 ±11%、手持物/头侧件落在对应区间等。
2. **视觉对照表**（`tools/shoot-accessories.mjs`）：每个配件在 baby/adult 两阶段实拍宠物区域，拼成带标签的对照表人工复检（工具目录 `tools/acc-audit/`）。

## 复检操作

```bash
node apps/pet/tools/audit-accessories.mjs            # 程序化审计 → report.json
node apps/pet/tools/shoot-accessories.mjs            # 全量截图 + 对照表（需先构建 out/）
node apps/pet/tools/shoot-accessories.mjs --stages baby --ids strawhat,b4b-18 --full   # 单件排查
node apps/pet/tools/gen-audit-doc.mjs                # 重新生成本文档
```

- 只复检：表格中 ⚠️/❌ 的行 + 新增配件；✅ 行跳过。
- 布局常量改了，必须同步 `audit-accessories.mjs` 里的 `layoutOf()`（两处保持一致）。

## 结论摘要（最近全量核验：2026-10-26）

- 自动检查：PASS 142 / WARN 0 / FAIL 0 / MISS 0。
- 视觉复检：142 件 × baby/adult 两阶段对照表全览；发现并修复的问题见下。

## 修复记录

| 日期 | 范围 | 问题 | 处理 |
|---|---|---|---|
| 2026-10-26 | 全部 hat（25 件在 adult 触发） | adult 眼线 22%，帽檐下缘 22–25% 盖住眼睛 | hat 布局 adult y 3→0、宽 28→26（PetSprite `accessoryLayout`） |
| 2026-10-26 | 全槽位 | 固定坐标不随阶段缩放（围巾盖脸/挎包上头/耳机挡眼） | 引入槽位化布局：hat/ears/helmet/neck/neckSmall/eyes/headSide/held/back/bodyFront，按眼线/喙位推导 |
| 2026-10-26 | back 槽 | 挎包/背包整件被身体遮挡、翅膀/披风几乎不可见 | 翅膀 w125、披风 w125 垫底；背包/挎包挂身侧 z15/z30 |
| 2026-10-26 | b4b-53 | baby: warn:眼罩素材是整条横带，呈现双眼蒙眼效果；adult: warn:同 baby | 素材本身为整条眼罩带（非单眼贴），视觉可接受 |
| 2026-10-26 | b4b-68 | baby: warn:右翼被身体遮挡，仅左翼可见；adult: warn:同 baby | 冰晶翅膀素材偏单侧构图 |
| 2026-10-26 | b4b-18 | baby: warn:救生圈围在颈/上胸，读作泳圈造型 |  |
| 2026-10-26 | b4b-73 | baby: warn:金线围巾素材偏细，存在感弱但可见 |  |

## 台账

（b=baby，t=teen，a=adult；"视觉"列为人工对照表结论；✅=通过，⚠️=可接受但留意，🔧=已修复）

### 帽类（头顶）（50 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| beanie | 绒球毛线帽 / Pom Beanie | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| strawhat | 丝带草帽 / Straw Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| crown | 小皇冠 / Tiny Crown | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| party | 派对 cone 帽 / Party Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| santa | 圣诞帽 / Santa Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| pumpkin | 南瓜帽 / Pumpkin Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| wizard | 巫师帽 / Wizard Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| chef | 厨师帽 / Chef Toque | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| detective | 侦探帽 / Detective Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| beret | 画家贝雷帽 / Artist Beret | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| cap | 棒球帽 / Baseball Cap | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| bucket | 小雨帽 / Rain Bucket | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| flower-crown | 雏菊花冠 / Daisy Crown | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| grad-cap | 毕业帽 / Grad Cap | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| tophat | 绅士礼帽 / Top Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| straw-circle | 斗笠 / Kasa Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| veil | 头纱 / Little Veil | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| crown-flower | 樱花冠 / Sakura Crown | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| helmet-wood | 维京盔 / Viking Helm | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| nightcap | 睡帽 / Nightcap | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| raincoat-hood | 雨衣帽 / Rain Hood | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| crown-ice | 冰晶冠 / Ice Crown | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| mushroom-hat | 蘑菇帽 / Mushroom Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| crown-laurel | 桂冠 / Laurel Crown | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| bonnet | 淑女帽 / Vintage Bonnet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-5 | 嫩芽发带 / Sprout Band | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-8 | 波点雨帽 / Rain Bonnet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-11 | 兔耳兜帽 / Bunny Hood | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-15 | 西瓜渔夫帽 / Melon Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-16 | 棕榈草帽 / Palm Straw Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-26 | 橡果贝雷帽 / Acorn Beret | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-27 | 狐狸耳发箍 / Fox Ear Band | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-28 | 南瓜毛线帽 / Pumpkin Beanie | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-29 | 麦穗花环 / Wheat Wreath | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-38 | 白色绒球帽 / White Pom Beanie | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-42 | 北极熊耳发箍 / Polar Band | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-49 | 骑士头盔 / Knight Helmet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-50 | 公主皇冠 / Princess Tiara | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-51 | 女巫帽 / Witch Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-52 | 海盗三角帽 / Pirate Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-56 | 消防头盔 / Fire Helmet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-57 | 警帽 / Police Cap | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-58 | 水手帽 / Sailor Cap | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-59 | 探险头盔 / Pith Helmet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-60 | 矿工头盔 / Miner Helmet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-61 | 飞行帽 / Aviator Cap | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-62 | 牛仔帽 / Cowboy Hat | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-63 | 忍者头带 / Ninja Band | b:✅ t:✅ a:✅ | ✅ | ✅ | 忍者头带结在头顶侧，带身较细 |
| b4b-67 | 水晶发冠 / Crystal Crown | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-78 | 牛仔小帽 / Denim Cap | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

### 耳机/耳罩（头部两侧）（2 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| headphones | 粉粉耳机 / Headphones | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| earmuffs | 毛绒耳罩 / Earmuffs | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

### 全覆头盔（1 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| space-helmet | 太空头盔 / Space Helmet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

### 围巾/披肩类（颈部大件）（14 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| scarf-star | 星星围巾 / Star Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| scarf-plaid | 格纹围巾 / Plaid Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| scarf-red | 红围巾 / Red Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| scarf-yellow | 芥末黄围巾 / Mustard Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| bandana | 波点方巾 / Bandana | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| scarf-check | 格纹绿围巾 / Check Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| scarf-rainbow | 彩虹围巾 / Rainbow Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| tie | 蝴蝶领结 / Bow Tie | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-10 | 绿叶围巾 / Leaf Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-18 | 救生圈 / Life Ring | b:✅ t:✅ a:✅ | ⚠️ 救生圈围在颈/上胸，读作泳圈造型 | ✅ |  |
| b4b-20 | 海浪围巾 / Wave Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-33 | 橙色格纹围巾 / Plaid Orange Scarf | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-65 | 羽毛披肩 / Feather Shawl | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-73 | 金线刺绣围巾 / Gold Scarf | b:✅ t:✅ a:✅ | ⚠️ 金线围巾素材偏细，存在感弱但可见 | ✅ |  |

### 项链/胸针/领结（颈部小件）（18 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| necklace | 小鱼项链 / Fish Necklace | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| bell | 铃铛项圈 / Bell Collar | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-4 | 四叶草胸针 / Clover Brooch | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-6 | 紫藤胸花 / Wisteria Corsage | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-7 | 彩虹别针 / Rainbow Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-19 | 花环项链 / Flower Lei | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-24 | 帆船别针 / Sailboat Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-30 | 蘑菇胸针 / Mushroom Brooch | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-31 | 松果项链 / Pinecone Necklace | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-32 | 栗子胸针 / Chestnut Brooch | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-34 | 琥珀项链 / Amber Necklace | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-40 | 雪花球项链 / Snow Globe Necklace | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-43 | 手套挂绳 / Mittens | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-44 | 水晶雪花胸针 / Crystal Snow Brooch | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-46 | 雪人纽扣胸针 / Snowman Brooch | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-71 | 玻璃鞋别针 / Slipper Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-77 | 蕾丝领 / Lace Collar | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-79 | 大理石珠项链 / Marble Necklace | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

### 眼镜类（跟随眼线）（9 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| glasses | 圆框眼镜 / Round Glasses | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| sunglasses | 墨镜 / Sunglasses | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| star-glasses | 星星眼镜 / Star Glasses | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| monocle | 单片眼镜 / Monocle | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| glasses-heart | 爱心眼镜 / Heart Glasses | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| glasses-3d | 3D 眼镜 / 3D Glasses | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| visor | 科幻护目镜 / Sci Visor | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-17 | 浮潜面罩 / Snorkel Mask | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-53 | 海盗眼罩 / Eye Patch | b:✅ t:✅ a:✅ | ⚠️ 眼罩素材是整条横带，呈现双眼蒙眼效果 | ⚠️ 同 baby | 素材本身为整条眼罩带（非单眼贴），视觉可接受 |

### 发夹/发针（头侧）（26 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| bow | 粉色蝴蝶结 / Pink Bow | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| flower | 向日葵发夹 / Sunflower Clip | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| hairpin | 月亮发夹 / Moon Hairpin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| badge-star | 星星徽章 / Star Badge | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-1 | 樱花发夹 / Sakura Clip | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-2 | 郁金香帽针 / Tulip Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-3 | 蝶翼发夹 / Butterfly Clip | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-12 | 樱花绒球发绳 / Sakura Pom | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-13 | 贝壳发夹 / Shell Clip | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-14 | 海星发针 / Starfish Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-21 | 水母挂针 / Jellyfish Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-22 | 珊瑚发针 / Coral Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-23 | 冰棒发夹 / Ice Pop Clip | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-25 | 枫叶发针 / Maple Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-35 | 银杏发针 / Ginkgo Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-37 | 冰蓝雪花发夹 / Snowflake Clip | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-41 | 冰晶发针 / Icicle Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-45 | 冬青果发针 / Holly Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-47 | 拐杖糖发夹 / Candy Cane Clip | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-48 | 极光薄纱 / Aurora Veil | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-66 | 彩虹羽发针 / Rainbow Feather | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-69 | 木雕叶发针 / Wood Leaf Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-72 | 青花瓷发针 / Porcelain Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-75 | 果冻发夹 / Jelly Pin | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-76 | 葡萄紫丝绒蝴蝶结 / Grape Bow | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-80 | 闪纱小头纱 / Tulle Veil | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

### 手持物（身侧）（11 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| watch | 小手表 / Wristwatch | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| pin-wheel | 小风车 / Pinwheel | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| umbrella | 小黄伞 / Yellow Umbrella | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| balloon-hand | 气球束 / Balloon Bunch | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| camera | 小相机 / Camera | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| icecream | 冰淇淋 / Ice Cream | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| flag | 小旗子 / Pennant | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| book | 故事书 / Storybook | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-9 | 雏菊手链 / Daisy Bracelet | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-64 | 魔术棒 / Magic Wand | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-74 | 银铃手链 / Silver Bell | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

### 背后件（翅膀/披风/背包/挎包）（10 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| backpack | 旅行小背包 / Travel Pack | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| wings | 小天使翅膀 / Angel Wings | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| cape | 英雄披风 / Hero Cape | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| bag-star | 星星小包 / Star Bag | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| backpack-bear | 小熊背包 / Bear Pack | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-36 | 橡果小包 / Acorn Bag | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-39 | 白色毛绒披风 / Fur Cape | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-54 | 皇家披风 / Royal Cape | b:✅ t:✅ a:✅ | ✅ | ✅ |  |
| b4b-68 | 冰晶翅膀 / Ice Wings | b:✅ t:✅ a:✅ | ⚠️ 右翼被身体遮挡，仅左翼可见 | ⚠️ 同 baby | 冰晶翅膀素材偏单侧构图 |
| b4b-70 | 草编小包 / Straw Bag | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

### 身前大件（围裙）（1 件）

| id | 名称 | 自动检查 b/t/a | 视觉 baby | 视觉 adult | 备注 |
|---|---|---|---|---|---|
| b4b-55 | 厨师围裙 / Chef Apron | b:✅ t:✅ a:✅ | ✅ | ✅ |  |

