import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const home = read("app/ui/HomeUploadStep.tsx");
assert.match(home, /병원에서 검사 전<br \/>/);
assert.match(home, /안내문 받으셨죠\?/);
assert.match(home, /className="uploadPrimaryButton"/);
assert.match(home, /className="uploadMethodSheet"/);
assert.match(home, /aria-label="저장된 안내문 사진 선택"/);
assert.match(home, /aria-label="카메라로 안내문 사진 찍기"/);
assert.match(home, /accept="image\/\*,\.pdf,application\/pdf"/);
assert.match(home, /multiple/);
assert.match(home, /capture="environment"/);
assert.doesNotMatch(home, /dropArea|dragOver|기존 프로젝트/);

const preview = read("app/ui/UploadPreviewStep.tsx");
assert.match(preview, /안내문 \{files\.length\}장을/);
assert.match(preview, /문서 분석하기/);
assert.match(preview, /한 장 더 추가/);
assert.match(preview, /다시 찍기/);
assert.match(preview, /onMove/);
assert.match(preview, /onRemove/);

const page = read("app/page.tsx");
assert.match(page, /setStep\("UPLOAD_REVIEW"\)/);
assert.match(page, /setStep\("ANALYZING"\)/);
assert.match(page, /setStep\("DOCUMENT_REVIEW"\)/);
assert.match(page, /setStep\("GUIDE"\)/);
assert.doesNotMatch(page, /QUESTIONS|QuestionStep|questionIndex|answerQuestion/);
assert.match(page, /answers: \{\}/);

const guide = read("app/ui/GuideStep.tsx");
assert.match(guide, /groupGuidePages/);
assert.match(guide, /groups\.map/);
assert.match(guide, /className="verticalGuideDocument screenOnly"/);
assert.match(guide, /PDF 저장/);
assert.match(guide, /EasyReadPrintDocument/);
assert.match(guide, /visiblePages/);
assert.match(guide, /PersonalizePanel/);
assert.doesNotMatch(guide, /pageArrow|bookViewer|onPage|pageIndex|overview|carousel|currentSlide/);

const instruction = read("app/ui/GuideInstructionBlock.tsx");
assert.match(instruction, /className=\{`guideInstruction/);
assert.match(instruction, /PictureCard/);
assert.match(instruction, /instructionTime/);

const css = read("app/globals.css");
assert.match(css, /\.verticalGuideDocument\s*\{[\s\S]*?width: min\(760px, 100%\)/);
assert.match(css, /\.guideInstruction\s*\{[\s\S]*?break-inside: avoid/);
assert.match(css, /@media \(max-width: 370px\)/);
assert.match(css, /@media print[\s\S]*?\.interactiveOnly/);
assert.match(css, /\.instructionContent \{ display: grid/);
assert.match(css, /\.easyReadPrintPage\s*\{[\s\S]*?width: 210mm/);
assert.match(css, /\.easyReadPrintContent\s*\{[\s\S]*?grid-template-columns: 64mm/);

console.log("vertical UI flow fixtures: 36 passed");
