"use client";

import { type ChangeEvent, useRef, useState } from "react";

export interface UploadFile {
  id: string;
  file: File;
  preview: string | null;
}

interface Props {
  onAdd: (files: FileList | null) => void;
}

export default function HomeUploadStep({ onAdd }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [showMethods, setShowMethods] = useState(false);
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onAdd(event.target.files);
    event.target.value = "";
  };

  return (
    <section className="homeUploadScreen" aria-labelledby="home-heading">
      <div className="homeIntro">
        <h1 id="home-heading" data-screen-title tabIndex={-1}>
          병원에서 검사 전<br />
          <strong>안내문 받으셨죠?</strong><br />
          <strong>올려주세요!</strong>
        </h1>
        <p>쉬운 말과 그림으로 정리해 드려요.</p>
      </div>

      <input
        hidden
        ref={fileInput}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        onChange={handleFiles}
      />
      <input
        hidden
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFiles}
      />

      <div className="uploadPanel">
        <button
          className="uploadPrimaryButton"
          type="button"
          aria-expanded={showMethods}
          aria-controls="upload-methods"
          onClick={() => setShowMethods((value) => !value)}
        >
          올리기
        </button>

        {showMethods && (
          <div id="upload-methods" className="uploadMethodSheet" aria-label="안내문 올리기 방법">
            <button
              type="button"
              aria-label="저장된 안내문 사진 선택"
              onClick={() => fileInput.current?.click()}
            >
              <span aria-hidden="true">▧</span>
              <b>사진 선택</b>
              <small>저장된 안내문을 골라요</small>
            </button>
            <button
              type="button"
              aria-label="카메라로 안내문 사진 찍기"
              onClick={() => cameraInput.current?.click()}
            >
              <span aria-hidden="true">▣</span>
              <b>사진 찍기</b>
              <small>안내문을 바로 찍어요</small>
            </button>
          </div>
        )}
      </div>

      <details className="homeFileHelp">
        <summary>파일 이용 안내</summary>
        <p>사진이나 PDF를 여러 장 올릴 수 있어요. 이름과 주민번호는 가려 주세요.</p>
      </details>

      <button className="homeAnalyzeHint" type="button" disabled aria-disabled="true">
        문서 분석하기
      </button>
    </section>
  );
}
