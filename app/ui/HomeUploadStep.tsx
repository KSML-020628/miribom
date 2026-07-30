"use client";

import { type ChangeEvent, useRef } from "react";

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
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onAdd(event.target.files);
    event.target.value = "";
  };

  return (
    <section className="homeUploadScreen" aria-labelledby="home-heading">
      <div className="homePurposeMark" aria-hidden="true">쉬운 말</div>
      <div className="homeIntro">
        <h1 id="home-heading" data-screen-title tabIndex={-1}>
          병원 안내문을<br />쉽게 바꿔 드려요
        </h1>
        <p>사진을 올리면<br />쉬운 말과 그림으로 정리해 드려요.</p>
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

      <div className="homeUploadChoices" aria-label="안내문 올리기 방법">
        <button
          className="uploadChoiceCard chooseFile"
          type="button"
          aria-label="저장된 안내문 사진 선택"
          onClick={() => fileInput.current?.click()}
        >
          <span className="choiceIcon" aria-hidden="true">▧</span>
          <b>사진 선택</b>
          <small>저장된 안내문을 골라요</small>
        </button>
        <button
          className="uploadChoiceCard takePhoto"
          type="button"
          aria-label="카메라로 안내문 사진 찍기"
          onClick={() => cameraInput.current?.click()}
        >
          <span className="choiceIcon" aria-hidden="true">▣</span>
          <b>사진 찍기</b>
          <small>안내문을 바로 찍어요</small>
        </button>
      </div>

      <details className="homeFileHelp">
        <summary>파일 이용 안내</summary>
        <p>사진이나 PDF를 여러 장 올릴 수 있어요. 이름과 주민번호는 가려 주세요.</p>
      </details>
    </section>
  );
}
