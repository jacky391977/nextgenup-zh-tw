/* Built-in Traditional Chinese guide. Content is bundled; opening a guide never starts a job. */
(() => {
  'use strict';
  const topics = [
    {id:'start', group:'入門', title:'第一次使用', keywords:'開始 下載 安裝 免費 離線 儲存 操作', intro:'先選功能，再匯入檔案。處理完成後記得儲存結果。',
      steps:[['選擇左側功能','照片變清楚選「圖片超分」；修復照片選「老照片修復」；處理影片選「影片超分 4K」。'],['匯入原始檔案','將檔案拖到中央區域，或點一下中央區域開啟檔案選擇器。建議使用手邊最清楚的原始檔。'],['設定處理方式','依功能選擇模式、倍率或修復選項。第一次先處理一張照片或一小段影片，確認效果與速度。'],['開始並等候完成','按該頁的開始按鈕，查看進度。下載模型和實際處理是不同階段；處理期間請保持程式開啟。'],['比較與檢查','檢查人物、文字、邊緣和聲音。老照片修復與降噪頁面可拖動分隔線，比較左邊原圖、右邊結果。'],['儲存到下載項目','按「儲存 PNG」、「儲存」或「儲存結果」等按鈕；在儲存視窗選「下載項目」，再確認儲存。處理完成不代表已另存到下載項目。']],
      notes:['內建教學可直接在程式裡閱讀，不需要連網。部分 AI 模型在第一次使用時需要連網下載；瀏覽器 AI 模式也可能需要載入運算元件。','目前這份教學對應 NextGenUp 1.2.0 繁體中文版。畫面未出現的選項，可能需要額外模型或目前環境不支援。'],
      links:['video','restore','compare','models']},
    {id:'video', group:'影片', title:'影片超分與 480p 轉 4K', tab:'video', keywords:'視頻 低畫質 解析度 480p 4k 2160p 2x 4x 高清', intro:'放大影片尺寸並改善觀感。AI 超分較慢，先用短片比較效果。',
      steps:[['開啟「影片超分 4K」','匯入 MP4、MOV、WebM、MKV 或 AVI 影片；頁面會顯示原始解析度、幀率和長度。'],['選擇處理模式','「基本放大」使用 FFmpeg 放大與銳化，速度較快；「專業 AI 超分」使用 Real-ESRGAN 逐影格處理，可能耗時較長。'],['設定倍率並檢查尺寸','基本放大可選 2x 或 4x，倍率會同時放大寬度與高度。此版本的專業 AI 超分固定以 4 倍模型輸出；完成後請檢查實際解析度。'],['按「開始超分」','等候影格進度與編碼完成。若需要停止，使用畫面上的「取消」，請勿直接關閉程式。'],['播放檢查並儲存','完成後播放結果，檢查畫面與聲音，再按儲存按鈕選擇「下載項目」。']],
      table:{headers:['原片尺寸','選 4x 後','是否為橫向 4K UHD'],rows:[['854 × 480','3416 × 1920','尚未達到'],['640 × 480（4:3）','2560 × 1920（4:3）','尚未達到'],['960 × 540（16:9）','3840 × 2160','是']]},
      notes:['4x 代表寬、高各放大 4 倍，不是「一定轉成 4K」。基本放大保留比例，長邊上限為 3840；專業 AI 在此版本固定 4 倍，選 2x 或遇到較大原片時，預估尺寸可能與實際結果不同。請以完成後的檔案尺寸為準。','854 × 480 的影片即使選 4x，也只會變成 3416 × 1920。若一定要輸出 3840 × 2160，需要另外按原片比例縮放或補邊；此頁沒有自訂尺寸輸入欄位。','AI 會估算細節，無法保證還原原本不存在的文字、臉部細節或真實 4K 拍攝品質。避免對同一段影片反覆 AI 超分，以免出現假細節。','影片越長、幀率越高、輸出越大，時間與暫存空間需求通常越多。WebGPU 顯示就緒也不代表處理會即時完成。'],links:['vtools','saving','trouble']},
    {id:'restore', group:'圖片', title:'老照片修復', tab:'restore', keywords:'照片修好 黑白 上色 修復臉部 強化細節', intro:'為黑白照片上色，或改善照片細節。彩色照片通常只需勾選強化細節。',
      steps:[['開啟「老照片修復」並選照片','支援 PNG、JPG、WebP、BMP、TIFF，每張上限 50 MB。'],['依照片選擇修復選項','黑白照想變彩色才勾「黑白照片上色」。已經是彩色的照片，可取消這一項，再勾「強化細節」。若畫面有「修復臉部」，才可選擇使用。'],['按「開始修復照片」','若顯示下載模型，等候首次下載完成後繼續處理。'],['拖曳分隔線檢查效果','修復完成後會出現單張前後比對圖：左邊原圖、右邊修復結果。也可按「並排檢視」。'],['按「儲存 PNG」','選擇下載項目或其他資料夾，儲存為新檔。']],
      notes:['修復和放大是兩件事；老照片修復不一定改變解析度。想把照片放大，可另用「圖片超分」。','自動上色產生的是 AI 推測的顏色；修復臉部也可能改變五官，請仔細比較。'],links:['compare','image','models']},
    {id:'compare', group:'圖片', title:'單張照片拖曳比對', tab:'restore', keywords:'中間 線 拉 左右 前後 對照 原圖 新圖 舊的 新的 滑桿', intro:'同一張照片，左側看原圖，右側看修復結果。',
      steps:[['先完成照片處理','在「老照片修復」或「降噪與去模糊」完成一次處理。還沒有結果時，不會出現拖曳比對。'],['拖動照片上的分隔線','在照片上按住滑鼠並左右拖動，便能比較同一個位置。左邊始終是原圖，右邊始終是結果。'],['也可使用下方滑桿','下方百分比表示原圖顯示的比例；0% 全部顯示結果，100% 全部顯示原圖。'],['切換並排或回到中間','按「並排檢視」看兩張圖；再按「拖曳比對」切回。連按照片兩下，可將分隔線回到 50%。'],['用鍵盤精細調整','按 Tab 移到下方滑桿，再用左右方向鍵微調；Home 到 0%，End 到 100%。']],
      image:'/static/help/photo-compare.svg', caption:'操作示意：左邊原圖、右邊結果；示意圖不代表實際修復品質。',
      notes:['這個新增的單張比對適用於老照片修復、降噪與去模糊。「圖片超分」有自己的前後對照區；影片目前以播放器查看。'],links:['restore','clean']},
    {id:'image', group:'圖片', title:'圖片超分與放大', tab:'image', keywords:'照片 放大 倍率 快速 高品質 極致 AI 2x 4x 批次', intro:'讓小圖變成較大的圖片；依速度與效果選擇模式。',
      steps:[['匯入一張或多張照片','開啟「圖片超分」，拖入圖片或點選檔案。多選圖片會進入批次處理。'],['選擇模式','先依下面的模式說明選擇。想要 AI 放大，可用「快速超分」或畫面提供的「極致 AI 超分」。'],['選擇倍率並開始','放大選 2x 或 4x，查看輸出解析度，再按「開始超分」。畫質增強則保持原尺寸。'],['查看前後對照並儲存','完成後查看前後對照，按儲存按鈕。批次處理可按「儲存全部結果（.zip）」。']],
      table:{headers:['模式','用途'],rows:[['快速超分','Real-ESRGAN AI，在程式的網頁介面中運算。'],['高品質放大','FFmpeg Lanczos 放大與 CAS 銳化。'],['畫質增強','AI 清理雜訊、保持原尺寸。'],['極致 AI 超分','本機引擎執行 Real-ESRGAN；有提供此選項時可使用。']]},
      notes:['「高品質放大」使用一般縮放與銳化；名稱不表示它一定比 AI 模式更能補出細節。建議用同一張圖比較。','4x 的總像素數約為原本的 16 倍，會增加運算與記憶體需求。'],links:['clean','compare','saving']},
    {id:'clean', group:'圖片', title:'降噪與去模糊', tab:'clean', keywords:'雜訊 顆粒 雜點 模糊 失焦 晃動 批次', intro:'雜訊是照片裡的顆粒、雜點或彩色小點；去模糊則嘗試改善不清楚的邊緣。',
      steps:[['開啟功能並匯入圖片','支援多選批次；每張圖片上限 50 MB。'],['選「移除雜訊」或「去除模糊」','暗處顆粒多選移除雜訊；邊緣不清楚、輕微模糊選去除模糊。依畫面查看適用情境。'],['按「開始清理圖片」','首次使用該模型可能先下載。批次時按「開始批次處理」。'],['比對並儲存','單張完成後可拖曳分隔線比較，再按「儲存 PNG」；批次可另存全部結果 ZIP。']],
      notes:['嚴重失焦、晃動或壓縮造成的缺失，可能無法修復。降噪過後也可能讓皮膚或紋理變得平滑，請與原圖比較。'],links:['compare','models']},
    {id:'bg', group:'圖片', title:'圖片去背', tab:'bg', keywords:'透明 背景 白色 自訂 BiRefNet 224mb', intro:'將主體與背景分開，輸出透明、白色或指定顏色的背景。',
      steps:[['首次先下載 AI 模型','如果看到「首次設定」，按「下載 AI 模型」。BiRefNet 約 224 MB，完成一次後即可使用本機模型。'],['匯入圖片並選背景','可選透明、白色或自訂顏色，也支援多張圖片。'],['開始去背並檢查邊緣','特別檢查頭髮、玻璃、陰影和細小物件。'],['儲存結果','需要透明背景時保留 PNG 格式；批次可儲存全部結果 ZIP。']],
      notes:['去背模型是這個功能所需的檔案；你只使用影片超分時，不必先下載去背模型。','透明 PNG 在某些看圖程式裡會顯示白色或黑色底，仍可能保有透明資訊。'],links:['models','saving']},
    {id:'erase', group:'圖片', title:'魔術橡皮擦', tab:'erase', keywords:'路人 電線 雜物 物件 塗抹 筆刷 LaMa', intro:'塗抹不要的物件，讓 AI 依周圍畫面補上空缺。',
      steps:[['匯入照片','開啟「魔術橡皮擦」並選擇圖片。'],['調整筆刷並塗抹物件','覆蓋要移除的物件與邊緣。塗錯可按「清除塗抹」重新畫。'],['按「移除物件」','等候結果，可分次移除不同物件。'],['不滿意時復原並重試','使用「復原上次移除」，調整塗抹範圍再試；滿意後按「儲存 PNG」。']],
      notes:['大面積遮擋、複雜背景和文字可能補得不自然。補出的內容是 AI 推測，建議每次只移除一個小區域。'],links:['models','saving']},
    {id:'sep', group:'音訊', title:'人聲與伴奏分離', tab:'sep', keywords:'卡拉ok 歌曲 純人聲 伴唱 音樂 MDX', intro:'從歌曲中分離人聲與伴奏，可製作伴唱版本或擷取人聲。',
      steps:[['匯入歌曲','開啟「人聲與伴奏分離」，選擇 MP3、WAV、FLAC、M4A 等支援的音訊。'],['按「開始分離人聲」','首次使用可能先下載分離模型，之後在本機處理。'],['分別播放人聲與伴奏','聆聽人聲是否殘留、樂器是否被一起移除。'],['儲存需要的音軌','各按鈕可分別儲存，或按「儲存人聲與伴奏（.zip）」一次保留兩份。']],
      notes:['分離結果可能殘留回音、人聲或樂器，不能保證完全分離。'],links:['adenoise','vtools']},
    {id:'adenoise', group:'音訊', title:'音訊降噪', tab:'adenoise', keywords:'錄音 旁白 語音 Podcast 風聲 電流 嘶聲', intro:'清理語音錄音中的背景雜訊，適合訪談與旁白。',
      steps:[['匯入錄音','開啟「音訊降噪」並選擇音訊檔。'],['按「移除雜訊」','等候模型載入與處理。'],['播放原始內容與清理結果','留意字尾、氣音和聲音是否變得不自然。'],['按「儲存」','儲存滿意的結果；要清理影片聲音，也可使用「影片工具」。']],
      notes:['此功能主要針對語音；不一定適合完整音樂錄音。嚴重爆音或破音通常無法靠降噪還原。'],links:['vtools','saving']},
    {id:'master', group:'音訊', title:'音訊母帶處理', tab:'master', keywords:'音量 響度 LUFS A/B 音色 EQ 24位元 WAV', intro:'分析音訊並調整音色、響度與立體聲，讓輸出更均衡。',
      steps:[['匯入音樂並等候分析','「開始母帶處理」啟用後，即可使用分析後的建議值。'],['先用自動設定處理','第一次不必調整全部滑桿，先按「開始母帶處理」聽效果。'],['使用 A／B 比較','切換「A · 原始音訊」與「B · 母帶處理後」，勾選「以相同響度比較」，減少因音量較大而誤判效果。'],['需要時微調後重新處理','可調音色、低音、高音、齒音、響度與立體聲寬度；「還原自動設定」可回復建議值。'],['儲存音訊','滿意後按「儲存 24 位元 WAV」。']],
      notes:['母帶處理不會把原本失真的錄音還原成完美錄音。響度拉得太高也可能讓音樂失去動態。'],links:['adenoise','saving']},
    {id:'tags', group:'音訊', title:'音樂標籤編輯', tab:'tags', keywords:'MP3 WAV 演出者 專輯 曲風 年份 標題 metadata', intro:'清除或改寫歌曲資訊，音訊內容保持不變。',
      steps:[['匯入 MP3 或 WAV','先查看檔案內原有的標籤。'],['選擇移除或改寫','選「移除全部標籤」，或選「改用我填寫的標籤」後填寫標題、演出者、專輯等欄位。'],['按「開始處理檔案」','查看處理後的標籤是否符合預期。'],['儲存處理後的檔案','結果區有儲存按鈕，另存新檔即可。']],
      notes:['標籤編輯只改歌曲資訊，不會提升音質或移除背景聲。'],links:['saving']},
    {id:'vtools', group:'影片', title:'影片工具：聲音、壓縮與 GIF', tab:'vtools', keywords:'移除配樂 移除人聲 壓縮影片 製作gif 大小 靜音', intro:'為影片清理聲音、分離配樂、縮小檔案或製作動態圖。',
      steps:[['匯入影片','開啟「影片工具」，匯入支援的影片，檔案上限 2 GB。'],['選擇一項工具','依下表選擇聲音處理、壓縮或 GIF；有額外選項時先設定。'],['按「開始處理」','聲音 AI 工具首次可能下載模型；處理期間查看進度。'],['預覽並按「儲存結果」','播放結果確認聲音與畫面，GIF 則查看動態圖，再儲存新檔。']],
      table:{headers:['工具','作用與設定'],rows:[['移除雜訊','清理影片音軌中的背景雜訊。'],['移除配樂','嘗試保留人聲、移除配樂。'],['移除人聲','嘗試保留配樂、移除人聲。'],['壓縮影片','選目標檔案大小；壓得越小，畫質通常損失越多。'],['製作 GIF','選每秒幀數與寬度；GIF 沒有音訊。']]},
      notes:['聲音分離可能有殘留。想提升影片解析度，請改用「影片超分 4K」。'],links:['video','sep','saving']},
    {id:'models', group:'入門', title:'首次下載、模型與本機處理', keywords:'網路 離線 免費 模型 設定 費用 空間', intro:'模型是 AI 的運算檔案。每個功能需要的模型可能不同。',
      steps:[['只下載你會用到的功能','遇到「下載 AI 模型」可依需求下載；未使用的功能不用先下載。'],['等候首次設定完成','首次通常比之後慢。下載失敗時，確認網路與可用空間，再重試。'],['下載後保留模型','模型存在程式資料夾裡，不是 ZIP 安裝包。刪除安裝包不會刪除已安裝的程式與模型。']],
      table:{headers:['功能','隨附版本的模型下載量（約）'],rows:[['圖片去背 · BiRefNet','224 MB'],['照片降噪 · SCUNet','77 MB（兩個檔案合計）'],['去模糊 · NAFNet','92 MB'],['黑白上色 · DDColor','135 MB'],['魔術橡皮擦 · LaMa','208 MB'],['人聲分離 · MDX-Net','67 MB'],['語音降噪 · DeepFilterNet3','8 MB 壓縮下載，解壓後另占空間']]},
      notes:['上表依此 1.2.0 版本的模型清單計算，下載畫面可能因 MB 換算而稍有不同。','這份安裝版本可直接使用內建功能，沒有在本機處理時計次收費。下載模型需要網路；照片與音訊的模型運算在本機執行。','瀏覽器 AI 模式首次還可能從網路載入運算元件；完整離線能否使用，需依功能與是否已備妥元件而定。'],links:['trouble','saving']},
    {id:'saving', group:'入門', title:'儲存檔案與批次處理', keywords:'下載項目 Finder 找不到 完成 輸出 ZIP 原始檔', intro:'先處理完成，再按儲存。結果不會因看過預覽就自動出現在下載項目。',
      steps:[['按完成畫面上的儲存按鈕','照片通常是「儲存 PNG」；影片或音訊依該頁按鈕操作。'],['在儲存視窗選「下載項目」','確認檔名與副檔名，避免覆蓋唯一的原始檔，再按儲存。'],['到檔案管理員 檢查新檔','開啟下載項目並播放或查看，確認畫面、聲音與長度正確。'],['多檔案使用批次','圖片超分、圖片去背、降噪與去模糊、影片超分支援多選；完成後可用「儲存全部結果（.zip）」。其他工具依單檔操作。']],
      notes:['如果取消儲存視窗，就不會另存檔案。批次 ZIP 下載後可在檔案管理員 連按兩下解壓縮。','ZIP 安裝包只用於重新安裝與還原，不必一直放在下載項目才能使用程式。'],links:['start','video']},
    {id:'trouble', group:'入門', title:'常見問題與排除', keywords:'卡住 很慢 失敗 開不了 比對 不能用 沒效果 黑畫面', intro:'先看提示文字，再從與問題最接近的一項開始排除。',
      faqs:[['處理很慢，是否當機？','AI 影片是逐影格運算。先看百分比、影格數或訊息是否仍有變化；首次下載與載入也需要時間。需要停止時先按取消；下次用短片、單張或較小倍率測試。'],['為什麼 480p 選 4x 還不是 4K？','倍率乘的是原始寬、高。854 × 480 放大 4 倍是 3416 × 1920，尚未到 3840 × 2160。詳見「影片超分與 480p 轉 4K」。'],['照片修好了，怎麼沒有拖曳比對？','要在老照片修復或降噪頁面完成一次處理後才出現。若目前是並排模式，按「拖曳比對」；只有原圖、尚無結果時不會顯示。'],['為什麼沒有修復臉部或極致 AI 選項？','有些選項只在所需模型或本機 AI 引擎可用時顯示。以目前程式畫面為準，不要因為教學提到就認為一定已安裝。'],['模型下載失敗怎麼辦？','確認網路可用、磁碟有空間，依提示重試。模型下載需要連到其來源網站；網路不通時其他已備妥的本機功能仍可能可以使用。'],['為什麼字或臉變奇怪？','AI 可能推測出錯誤細節。改用較小倍率、一般放大，或取消臉部修復／上色等選項；保留原始檔再比較。'],['顯示完成，但下載項目找不到？','請再按結果區的儲存按鈕，並在儲存視窗選下載項目。完成處理與另存檔案是兩個步驟。'],['專業 AI 超分失敗怎麼辦？','確認錯誤訊息、網路與可用記憶體，先用短片重試。若只需放大尺寸，可試基本放大；兩種模式的處理方式不同。'],['教學可以離線看嗎？','可以。文字與比對示意圖都放在這個程式裡；首次使用某些 AI 功能仍可能需要另外下載模型或運算元件。']],links:['video','models','saving']}
  ];
  const root = document.getElementById('tab-help');
  const dialog = document.getElementById('ng-help-dialog');
  if (!root || !dialog) return;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current = 'start';
  let opener = null;
  let focusAfterClose = null;
  let previousOverflow = '';
  let outsidePointerDown = false;
  root.innerHTML = `<div class="ng-help-heading"><h2 id="ng-help-title">使用說明與操作教學</h2><p>選一個主題跟著操作；點視窗外空白處或按 Esc 關閉。</p><button type="button" id="ng-help-close" aria-label="關閉教學視窗">關閉 ×</button></div><div class="ng-help-layout"><aside class="ng-help-index" aria-label="教學目錄"><label for="ng-help-search">搜尋教學</label><div class="ng-help-search-row"><input type="search" id="ng-help-search" placeholder="例如：480p、比對、去背" autocomplete="off"><button type="button" id="ng-help-clear" aria-label="清除搜尋">清除</button></div><p id="ng-help-count" role="status" aria-live="polite"></p><nav id="ng-help-topics" aria-label="教學主題"></nav></aside><article class="ng-help-article" id="ng-help-article" aria-label="操作教學內容"></article></div>`;
  const search = root.querySelector('#ng-help-search');
  const list = root.querySelector('#ng-help-topics');
  const article = root.querySelector('#ng-help-article');
  const count = root.querySelector('#ng-help-count');
  const normal = value => value.toLowerCase().replace(/\s+/g, '');
  const filtered = () => {
    const query = normal(search.value);
    return topics.filter(t => normal(JSON.stringify(t)).includes(query));
  };
  function renderArticle(topic, focus = false) {
    let html = `<div class="ng-help-article-head"><h3 tabindex="-1">${esc(topic.title)}</h3><p>${esc(topic.intro)}</p><div class="ng-help-actions">`;
    if (topic.tab) html += `<button type="button" class="ng-help-primary" data-open-tool="${topic.tab}">開啟此功能</button>`;
    html += `<button type="button" class="ng-help-back">關閉教學</button></div></div>`;
    if (topic.steps) html += `<ol class="ng-help-steps">${topic.steps.map(([title,text]) => `<li><h4>${esc(title)}</h4><p>${esc(text)}</p></li>`).join('')}</ol>`;
    if (topic.table) html += `<div class="ng-help-table-wrap"><table><thead><tr>${topic.table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${topic.table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (topic.image) html += `<figure><img src="${topic.image}" alt="NextGenUp 拖曳比對操作示意：單張照片中間有可拖曳分隔線，左邊原圖、右邊修復結果" loading="lazy" width="1280" height="860"><figcaption>${esc(topic.caption)}</figcaption></figure>`;
    if (topic.notes) html += `<section class="ng-help-notes" aria-label="使用提醒"><h4>使用提醒</h4>${topic.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</section>`;
    if (topic.faqs) html += `<div class="ng-help-faq">${topic.faqs.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
    if (topic.links) html += `<div class="ng-help-related"><h4>相關教學</h4>${topic.links.map(id=>`<button type="button" data-help-topic="${id}">${esc(topics.find(t=>t.id===id).title)}</button>`).join('')}</div>`;
    article.innerHTML = html;
    if (focus) {
      article.querySelector('h3').focus({preventScroll:true});
      article.scrollTop = 0;
    }
  }
  function update(focus = false) {
    const matches = filtered();
    count.textContent = search.value.trim() ? `找到 ${matches.length} 個主題` : `${topics.length} 個主題 · 可離線閱讀`;
    if (!matches.length) {
      list.innerHTML = '';
      article.innerHTML = '<div class="ng-help-empty"><h3>找不到相關教學</h3><p>試試「影片」、「比對」或「儲存」，或按「清除」查看全部主題。</p><button type="button" class="ng-help-reset-search">顯示全部教學</button></div>';
      return;
    }
    if (!matches.some(t=>t.id===current)) current = matches[0].id;
    list.innerHTML = ['入門','圖片','音訊','影片'].map(group => {
      const children = matches.filter(t=>t.group===group);
      if (!children.length) return '';
      return `<section class="ng-help-group" aria-label="${group}教學"><h4>${group}</h4>${children.map(t=>`<button type="button" data-help-topic="${t.id}"${t.id===current?' aria-current="page"':''}>${esc(t.title)}</button>`).join('')}</section>`;
    }).join('');
    renderArticle(topics.find(t=>t.id===current), focus);
  }
  function select(id, focus = true) {
    search.value = '';
    current = topics.some(t=>t.id===id) ? id : 'start';
    update(focus);
  }
  function openGuide(id) {
    if (!dialog.open) {
      opener = document.activeElement;
      focusAfterClose = opener;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
      ['nav-help','ng-help-header'].forEach(key=>document.getElementById(key).setAttribute('aria-expanded','true'));
    }
    select(id, false);
    article.scrollTop = 0;
    search.focus({preventScroll:true});
  }
  function closeGuide(target = opener) {
    focusAfterClose = target;
    dialog.close();
  }
  function openTool(tab) {
    const button = document.getElementById('nav-'+tab);
    if (!button || tab==='help') return;
    button.click();
    closeGuide(button);
  }
  search.addEventListener('input', ()=>update());
  root.querySelector('#ng-help-clear').addEventListener('click', ()=>{search.value='';update();search.focus();});
  root.addEventListener('click', event=>{
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.helpTopic) select(target.dataset.helpTopic);
    else if (target.dataset.openTool) openTool(target.dataset.openTool);
    else if (target.classList.contains('ng-help-back')) closeGuide();
    else if (target.classList.contains('ng-help-reset-search')) {search.value='';select('start');search.focus();}
  });
  document.getElementById('nav-help').addEventListener('click', ()=>openGuide('start'));
  document.getElementById('ng-help-close').addEventListener('click', ()=>closeGuide());
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener('pointerdown', event=>{outsidePointerDown = event.target===dialog && outside(event);});
  dialog.addEventListener('click', event=>{
    if (outsidePointerDown && event.target===dialog && outside(event)) closeGuide();
    outsidePointerDown = false;
  });
  // A search input may consume Escape to clear itself; close the dialog on the first press.
  dialog.addEventListener('keydown', event=>{
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeGuide();
    }
  }, true);
  dialog.addEventListener('close', ()=>{
    document.body.style.overflow = previousOverflow;
    outsidePointerDown = false;
    ['nav-help','ng-help-header'].forEach(key=>document.getElementById(key).setAttribute('aria-expanded','false'));
    if (focusAfterClose instanceof HTMLElement && focusAfterClose.isConnected) focusAfterClose.focus({preventScroll:true});
  });
  document.getElementById('ng-help-header').addEventListener('click', ()=>{
    const active = document.querySelector('.nav-item.active')?.dataset.tab;
    openGuide(topics.find(t=>t.tab===active)?.id || current);
  });
  // Keep the help entry close to each tool, without replacing or resetting its existing controls.
  document.querySelectorAll('main.tab-content:not(#tab-help)').forEach(main=>{
    const topic = topics.find(t=>t.tab===main.id.replace('tab-',''));
    if (!topic) return;
    const bar = document.createElement('div');
    bar.className='ng-tool-help-row';
    const button = document.createElement('button');
    button.type='button';button.className='ng-tool-help';button.textContent='操作教學';
    button.setAttribute('aria-label',topic.title+'操作教學');
    button.addEventListener('click',()=>openGuide(topic.id));
    bar.append(button);main.prepend(bar);
  });
  update();
})();
