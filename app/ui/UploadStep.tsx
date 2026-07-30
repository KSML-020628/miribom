"use client";

import { ChangeEvent, useRef } from "react";

export interface UploadFile {
  id: string;
  file: File;
  preview: string | null;
}

interface Props {
  files: UploadFile[];
  busy: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onAnalyze: () => void;
}

export default function UploadStep({ files, busy, onAdd, onRemove, onMove, onAnalyze }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => onAdd(event.target.files);

  return (
    <section className="stepScreen uploadStep" aria-labelledby="upload-heading">
      <div className="screenIntro">
        <h1 id="upload-heading" data-screen-title tabIndex={-1}>병원 안내문을<br />올려 주세요</h1>
        <p>사진을 찍거나 PDF 파일을 선택해 주세요.</p>
      </div>

      <div className="uploadActions">
        <input className="srOnly" ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={handleFiles} />
        <input className="srOnly" ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf" multiple onChange={handleFiles} />
        <button className="bigChoice primary" type="button" onClick={() => cameraInput.current?.click()}>
          <span aria-hidden="true">▣</span><b>사진 찍기</b>
        </button>
        <button className="bigChoice secondary" type="button" onClick={() => fileInput.current?.click()}>
          <span aria-hidden="true">＋</span><b>파일 선택</b>
        </button>
      </div>

      <div
        className="dropArea"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); onAdd(event.dataTransfer.files); }}
      >
        {files.length === 0 ? (
          <div className="dropEmpty"><strong>안내문 전체가 보이게 찍어 주세요</strong><span>여러 장도 올릴 수 있어요</span></div>
        ) : (
          <ol className="fileList" aria-label="올린 안내문">
            {files.map((item, index) => (
              <li key={item.id}>
                <div className="fileThumb">
                  {item.preview ? <img src={item.preview} alt={`${index + 1}번째 안내문 미리보기`} /> : <span>PDF</span>}
                </div>
                <div className="fileInfo"><b>{index + 1}번째 파일</b><span>{item.file.name}</span></div>
                <div className="fileControls">
                  <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="앞쪽으로 이동">↑</button>
                  <button type="button" onClick={() => onMove(index, 1)} disabled={index === files.length - 1} aria-label="뒤쪽으로 이동">↓</button>
                  <button type="button" className="remove" onClick={() => onRemove(item.id)} aria-label="이 파일 삭제">삭제</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <button className="mainAction" type="button" disabled={!files.length || busy} onClick={onAnalyze}>
        {busy ? "안내문을 읽고 있어요…" : "안내문 분석하기"}
      </button>
      <details className="privacyBox">
        <summary>개인정보 안내</summary>
        <p>이름과 주민번호는 가리고 올려 주세요. 올린 파일은 따로 저장하지 않아요.</p>
      </details>
    </section>
  );
}
