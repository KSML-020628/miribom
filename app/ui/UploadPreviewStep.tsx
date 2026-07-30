"use client";

import { type ChangeEvent, useRef } from "react";
import type { UploadFile } from "./HomeUploadStep";

interface Props {
  files: UploadFile[];
  busy: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onAnalyze: () => void;
  onBack: () => void;
}

export default function UploadPreviewStep({
  files,
  busy,
  onAdd,
  onRemove,
  onMove,
  onAnalyze,
  onBack,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onAdd(event.target.files);
    event.target.value = "";
  };

  return (
    <section className="stepScreen uploadPreviewStep" aria-labelledby="preview-heading">
      <div className="topTools">
        <button type="button" onClick={onBack}>← 처음으로</button>
      </div>
      <div className="screenIntro centered">
        <h1 id="preview-heading" data-screen-title tabIndex={-1}>안내문을 확인해 주세요</h1>
        <p>종이 전체와 글자가 잘 보이나요?</p>
      </div>

      <ol className="previewList" aria-label="선택한 안내문">
        {files.map((item, index) => (
          <li key={item.id}>
            <div className="previewImage">
              {item.preview
                ? <img src={item.preview} alt={`${index + 1}번째 안내문 미리보기`} />
                : <span aria-label={`${index + 1}번째 PDF 안내문`}>PDF</span>}
            </div>
            <div className="previewMeta">
              <b>{index + 1}번째 안내문</b>
              <span>{item.file.name}</span>
            </div>
            <div className="previewControls">
              <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`${index + 1}번째 안내문을 앞으로 이동`}>↑</button>
              <button type="button" onClick={() => onMove(index, 1)} disabled={index === files.length - 1} aria-label={`${index + 1}번째 안내문을 뒤로 이동`}>↓</button>
              <button type="button" className="remove" onClick={() => onRemove(item.id)}>삭제</button>
            </div>
          </li>
        ))}
      </ol>

      <input hidden ref={fileInput} type="file" accept="image/*,.pdf,application/pdf" multiple onChange={handleFiles} />
      <input hidden ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={handleFiles} />
      <div className="previewAddActions">
        <button type="button" onClick={() => fileInput.current?.click()}>＋ 한 장 더 추가</button>
        <button type="button" onClick={() => cameraInput.current?.click()}>▣ 다시 찍기</button>
      </div>

      <aside className="photoTip">
        <b>사진 확인</b>
        <p>흐리거나 잘린 사진은 삭제하고 다시 찍어 주세요.</p>
      </aside>

      <button className="mainAction previewAnalyzeButton" type="button" disabled={!files.length || busy} onClick={onAnalyze}>
        안내문 쉽게 바꾸기
      </button>
    </section>
  );
}
