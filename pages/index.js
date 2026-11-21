import { ReactSVG } from "react-svg";
import { useState, useEffect, useMemo, useCallback } from "react";
import { transform, parseAndroidResource } from 'vector-drawable-svg';
import SVG from 'react-inlinesvg';
import { useFilePicker } from 'react-sage';
import Head from "next/head";
import dynamic from "next/dynamic";
import GitHubButton from 'react-github-btn';
import { xml } from '@codemirror/lang-xml';
import { EditorView } from '@codemirror/view';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import CodeiumFooter from '../components/CodeiumFooter';
import { svgToVectorDrawable } from '../components/svg2vector';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
	ssr: false,
	loading: () => (
		<div style={{
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			height: '100%',
			minHeight: '380px',
			color: 'var(--vd-color-secondary-text)',
			fontFamily: '"JetBrains Mono", monospace',
			fontSize: '13px'
		}}>
			Loading Code Editor...
		</div>
	),
});

const STATE_NONE = -1;
const STATE_DRAG_LEAVE = 0;
const STATE_DRAGGING = 1;
const STATE_DROP = 2;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const getAssetUrl = (path) => {
	if (!path) return '';
	const clean = path.startsWith('/') ? path : `/${path}`;
	return `${basePath}${clean}`;
};

const SAMPLE_VECTOR_XML = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="120dp"
    android:height="120dp"
    android:viewportWidth="120"
    android:viewportHeight="120">
    <!-- Background Circle -->
    <path
        android:fillColor="#269BFF"
        android:pathData="M60,8 C31.3,8 8,31.3 8,60 C8,88.7 31.3,112 60,112 C88.7,112 112,88.7 112,60 C112,31.3 88.7,8 60,8 Z M60,102 C36.8,102 18,83.2 18,60 C18,36.8 36.8,18 60,18 C83.2,18 102,36.8 102,60 C102,83.2 83.2,102 60,102 Z"/>
    <!-- Center Checkmark Icon -->
    <path
        android:fillColor="#37A3FF"
        android:pathData="M52,78 L30,56 L37.1,48.9 L52,63.8 L82.9,32.9 L90,40 L52,78 Z"/>
</vector>`;

const SAMPLE_SVG = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Background Circle -->
    <circle cx="60" cy="60" r="52" fill="#269BFF" stroke="#37A3FF" stroke-width="4"/>
    <!-- Center Checkmark -->
    <path d="M40 60 L54 74 L82 46" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function createOverridePlaceholder(value) {
	const regex = /\@(\w+)\/(\w+)/gm;
	let result = null;
	const items = [];

	const defaults = {
		color: "#269BFF",
		dimen: "16dp",
		string: "None"
	};

	while ((result = regex.exec(value))) {
		items.push([result[1], result[2]]);
	}

	if (items.length === 0) {
		return '';
	}

	const innerElement = items.map(([tag, name]) => `  <${tag} name=${JSON.stringify(name)}>${defaults[tag] || '""'}</${tag}>`).join("\n");
	return `<!--missing values-->\n<resources>\n${innerElement}\n</resources>`;
}

function downloadBlob(filename, text, mime = 'image/svg+xml') {
	const element = document.createElement('a');
	element.setAttribute('href', `data:${mime};charset=utf-8,` + encodeURIComponent(text));
	element.setAttribute('download', filename);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

function isValidFileType(file) {
	if (!file) return false;
	const name = (file.name || '').toLowerCase();
	if (name.endsWith('.xml') || name.endsWith('.svg')) return true;
	return file.type === 'text/xml' || file.type === 'application/xml' || file.type === 'image/svg+xml';
}

function transformXmlSafe(value, options) {
	if (!value || typeof value !== 'string' || !value.trim()) {
		return { svg: null, error: null };
	}
	try {
		const svg = transform(value, options);
		if (!svg || !svg.includes('<svg')) {
			return { svg: null, error: 'Could not generate valid SVG from XML.' };
		}
		return { svg, error: null };
	} catch (e) {
		return { svg: null, error: e.message || 'Error parsing VectorDrawable XML.' };
	}
}

function dropzoneClassOfState(state) {
	if (state === STATE_DRAG_LEAVE) return '';
	if (state === STATE_DRAGGING) return 'vd-highlight';
	if (state === STATE_DROP) return 'vd-active';
	return '';
}

async function readFileContent(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

export default function Home() {
	const { files, onClick: onDropzoneClick, errors, HiddenFileInput } = useFilePicker({
		maxFileSize: 5,
	});

	const [xmlContent, setXmlContent] = useState(SAMPLE_VECTOR_XML);
	const [xmlResource, setXmlResource] = useState("<!--Android XML resources-->");
	const [transformedSvg, setTransformedSvg] = useState(null);
	const [conversionError, setConversionError] = useState(null);
	const [conversionSuccessMsg, setConversionSuccessMsg] = useState(null);
	const [vectorDrawableFile, setVectorDrawableFile] = useState({ name: 'sample-vector.xml' });
	const [dragState, setDragState] = useState(STATE_NONE);
	const [bgMode, setBgMode] = useState('dark'); // 'dark' | 'checkerboard' | 'light'
	const [copiedSvg, setCopiedSvg] = useState(false);
	const [copiedXml, setCopiedXml] = useState(false);
	const [copiedCli, setCopiedCli] = useState(false);
	const [wordWrap, setWordWrap] = useState(true);
	const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'preview'
	const [conversionMode, setConversionMode] = useState('xml2svg'); // 'xml2svg' | 'svg2xml'

	const editorExtensions = useMemo(() => {
		const exts = [xml()];
		if (wordWrap) {
			exts.push(EditorView.lineWrapping);
		}
		return exts;
	}, [wordWrap]);

	const override = useMemo(() => {
		try {
			const result = parseAndroidResource(xmlResource);
			if (result) return result;
		} catch (ignored) {
		}
		return {};
	}, [xmlResource]);

	// Auto-transform XML or SVG on content change
	useEffect(() => {
		if (!xmlContent || !xmlContent.trim()) {
			setTransformedSvg(null);
			setConversionError(null);
			return;
		}

		const trimmed = xmlContent.trim();
		const startsWithSvg = trimmed.startsWith('<svg') || trimmed.startsWith('<?xml') && trimmed.includes('<svg');

		if (startsWithSvg) {
			// Direct SVG input in editor
			setConversionMode('svg2xml');
			setTransformedSvg(trimmed);
			try {
				const generatedVector = svgToVectorDrawable(trimmed);
				setConversionError(null);
			} catch (e) {
				setConversionError('SVG Parsing: ' + e.message);
			}
		} else {
			// Android VectorDrawable XML input in editor
			setConversionMode('xml2svg');
			const { svg, error } = transformXmlSafe(xmlContent, { override });
			setTransformedSvg(svg);
			setConversionError(error);

			if (Object.keys(override).length === 0 && xmlResource.trim() === "<!--Android XML resources-->") {
				const placeholder = createOverridePlaceholder(xmlContent);
				if (placeholder) {
					setXmlResource(placeholder);
				}
			}
		}
	}, [xmlContent, override]);

	// Handle File drop/selection with bidirectional vice-versa auto-detection
	const processFile = useCallback(async (file) => {
		if (!file) return;
		try {
			const content = await readFileContent(file);
			const fileName = (file.name || '').toLowerCase();
			const isSvg = fileName.endsWith('.svg') || content.trim().startsWith('<svg');

			if (isSvg) {
				// SVG file dropped/uploaded -> convert to Android VectorDrawable XML!
				try {
					const vectorXml = svgToVectorDrawable(content);
					setXmlContent(vectorXml);
					setTransformedSvg(content);
					setVectorDrawableFile(file);
					setConversionMode('svg2xml');
					setConversionSuccessMsg(`Converted "${file.name}" (SVG) ➔ Android Vector XML!`);
					setConversionError(null);
					setTimeout(() => setConversionSuccessMsg(null), 4000);
				} catch (convErr) {
					// Fallback: place raw SVG in editor so user can inspect
					setXmlContent(content);
					setTransformedSvg(content);
					setVectorDrawableFile(file);
					setConversionMode('svg2xml');
					setConversionError('SVG Conversion Error: ' + convErr.message);
				}
			} else {
				// Android Vector XML file dropped/uploaded -> convert to SVG!
				setXmlContent(content);
				setVectorDrawableFile(file);
				setConversionMode('xml2svg');
				setConversionSuccessMsg(`Loaded "${file.name}" (VectorDrawable XML) ➔ SVG!`);
				setConversionError(null);
				setTimeout(() => setConversionSuccessMsg(null), 4000);

				const placeholder = createOverridePlaceholder(content);
				if (placeholder && Object.keys(override).length === 0) {
					setXmlResource(placeholder);
				}
			}

			setDragState(STATE_DROP);
			setActiveTab('preview');
		} catch (err) {
			setConversionError("Failed to read file: " + err.message);
		}
	}, [override]);

	// FilePicker listener
	useEffect(() => {
		if (files && files.length > 0) {
			const file = files[0];
			if (isValidFileType(file)) {
				processFile(file);
			}
		}
	}, [files, processFile]);

	const dragEnter = (e) => {
		e.stopPropagation();
		e.preventDefault();
		setDragState(STATE_DRAGGING);
	};

	const dragLeave = (e) => {
		e.stopPropagation();
		e.preventDefault();
		setDragState(STATE_DRAG_LEAVE);
	};

	const dragOver = (e) => {
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = 'copy';
	};

	const fileDrop = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		const droppedFiles = e.dataTransfer.files;

		if (droppedFiles && droppedFiles.length > 0) {
			const file = droppedFiles[0];
			if (isValidFileType(file)) {
				await processFile(file);
				return;
			}
		}
		setDragState(STATE_NONE);
	};

	const clearAll = (e) => {
		if (e) e.stopPropagation();
		setDragState(STATE_NONE);
		setVectorDrawableFile(null);
		setTransformedSvg(null);
		setXmlContent('');
		setConversionError(null);
		setConversionSuccessMsg(null);
	};

	const loadSample = () => {
		if (conversionMode === 'svg2xml') {
			setXmlContent(SAMPLE_SVG);
			setVectorDrawableFile({ name: 'sample-icon.svg' });
		} else {
			setXmlContent(SAMPLE_VECTOR_XML);
			setVectorDrawableFile({ name: 'sample-vector.xml' });
		}
		setConversionError(null);
		setConversionSuccessMsg(null);
	};

	// Vice-Versa Swap Action
	const swapViceVersa = () => {
		const trimmed = xmlContent.trim();
		if (trimmed.startsWith('<svg')) {
			// Currently SVG in editor -> convert to Android Vector XML
			try {
				const vectorXml = svgToVectorDrawable(trimmed);
				setXmlContent(vectorXml);
				setConversionMode('xml2svg');
				setVectorDrawableFile({ name: 'converted-vector.xml' });
				setConversionSuccessMsg('Converted SVG ➔ Android Vector XML!');
				setTimeout(() => setConversionSuccessMsg(null), 3000);
			} catch (err) {
				setConversionError('Cannot convert SVG: ' + err.message);
			}
		} else {
			// Currently XML in editor -> swap rendered SVG into editor
			if (transformedSvg) {
				setXmlContent(transformedSvg);
				setConversionMode('svg2xml');
				setVectorDrawableFile({ name: 'converted-icon.svg' });
				setConversionSuccessMsg('Swapped to SVG editor mode!');
				setTimeout(() => setConversionSuccessMsg(null), 3000);
			} else {
				setConversionError('No valid SVG available to swap.');
			}
		}
	};

	const downloadCurrentSvg = () => {
		if (!transformedSvg) return;
		let filename = 'vector.svg';
		if (vectorDrawableFile && vectorDrawableFile.name) {
			filename = vectorDrawableFile.name.replace(/\.(xml|svg)$/i, '') + ".svg";
		}
		downloadBlob(filename, transformedSvg, 'image/svg+xml');
	};

	const downloadCurrentXml = () => {
		let xmlToDownload = xmlContent;
		if (xmlContent.trim().startsWith('<svg')) {
			try {
				xmlToDownload = svgToVectorDrawable(xmlContent);
			} catch (err) {
				setConversionError('Could not export XML: ' + err.message);
				return;
			}
		}
		let filename = 'drawable.xml';
		if (vectorDrawableFile && vectorDrawableFile.name) {
			filename = vectorDrawableFile.name.replace(/\.(xml|svg)$/i, '') + ".xml";
		}
		downloadBlob(filename, xmlToDownload, 'application/xml');
	};

	const copySvgToClipboard = async () => {
		if (!transformedSvg) return;
		try {
			await navigator.clipboard.writeText(transformedSvg);
			setCopiedSvg(true);
			setTimeout(() => setCopiedSvg(false), 2000);
		} catch (err) {
			console.error("Failed to copy SVG: ", err);
		}
	};

	const copyXmlToClipboard = async () => {
		let textToCopy = xmlContent;
		if (xmlContent.trim().startsWith('<svg')) {
			try {
				textToCopy = svgToVectorDrawable(xmlContent);
			} catch (err) {
				setConversionError('Could not convert SVG to copy XML: ' + err.message);
				return;
			}
		}
		try {
			await navigator.clipboard.writeText(textToCopy);
			setCopiedXml(true);
			setTimeout(() => setCopiedXml(false), 2000);
		} catch (err) {
			console.error("Failed to copy XML: ", err);
		}
	};

	const copyCliCommand = async () => {
		try {
			await navigator.clipboard.writeText('npx vector-drawable-svg my-drawable.xml out.svg');
			setCopiedCli(true);
			setTimeout(() => setCopiedCli(false), 2000);
		} catch (err) {
			console.error("Failed to copy CLI command: ", err);
		}
	};

	const cycleBgMode = () => {
		if (bgMode === 'dark') setBgMode('checkerboard');
		else if (bgMode === 'checkerboard') setBgMode('light');
		else setBgMode('dark');
	};

	const bgLabel = bgMode === 'dark' ? 'Dark BG' : bgMode === 'checkerboard' ? 'Grid BG' : 'Light BG';

	const isSvgEditor = xmlContent.trim().startsWith('<svg');

	return (
		<>
			<Head>
				<title>VectorDrawable ⇄ SVG Web Studio — Live Bidirectional Converter</title>
				<meta name="description" content="Bidirectional conversion between Android VectorDrawable XML and SVG. Live editor, preview, and one-click export." />
				<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
			</Head>

			<main className="container">
				<div className="vd-form-center" style={{ width: '100%' }}>
				<HiddenFileInput accept=".xml,.svg" multiple={false} />

				{/* Header Section */}
				<div className="vd-head vd-form-center">
					<h1 className="vd-title">VectorDrawable ⇄ SVG</h1>
					<p className="vd-subtitle">
						Live bidirectional studio: Convert <strong>Android VectorDrawable XML to SVG</strong> and <strong>SVG to Android Vector XML</strong> with real-time preview
					</p>

					{/* Attribution Banner */}
					<div className="vd-credits-bar">
						<span>Original Engine & Design by <a href="https://github.com/seanghay" target="_blank" rel="noopener noreferrer">@seanghay</a></span>
						<span>•</span>
						<span>Enhanced by <a href="https://github.com/junksidetm" target="_blank" rel="noopener noreferrer">@junksidetm</a></span>
					</div>

					{/* GitHub Star Row */}
					<div className="vd-github-row">
						<GitHubButton
							href="https://github.com/seanghay/vector-drawable-nextjs"
							data-color-scheme="no-preference: light; light: dark; dark: dark;"
							data-icon="octicon-star"
							data-size="large"
							data-show-count="true"
							aria-label="Star seanghay/vector-drawable-nextjs on GitHub"
						>Star Upstream</GitHubButton>

						<GitHubButton
							href="https://github.com/junksidetm/vector-drawable-nextjs"
							data-color-scheme="no-preference: light; light: dark; dark: dark;"
							data-icon="octicon-star"
							data-size="large"
							data-show-count="true"
							aria-label="Star junksidetm/vector-drawable-nextjs on GitHub"
						>Star Fork</GitHubButton>
					</div>
				</div>

				{/* Mobile Segmented Tab Bar (< 768px) */}
				<div className="vd-mobile-segmented-control" role="tablist" aria-label="Workspace View">
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === 'editor'}
						className={`vd-segment-btn ${activeTab === 'editor' ? 'active' : ''}`}
						onClick={() => setActiveTab('editor')}
					>
						<span className="vd-badge">{isSvgEditor ? "SVG" : "XML"}</span>
						<span>Code Editor</span>
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === 'preview'}
						className={`vd-segment-btn ${activeTab === 'preview' ? 'active' : ''}`}
						onClick={() => setActiveTab('preview')}
					>
						<span className="vd-badge vd-badge-svg">LIVE</span>
						<span>Preview & Export</span>
						{transformedSvg && <span className="vd-indicator-dot" />}
					</button>
				</div>

				{/* Notification / Toast Feedback */}
				{conversionSuccessMsg && (
					<div className="vd-toast-indicator">
						<span>✓ {conversionSuccessMsg}</span>
					</div>
				)}

				{/* Dual-Pane Workspace */}
				<div className="vd-workspace">
					{/* Left Pane: Code Editor */}
					<div className={`vd-pane vd-pane-editor ${activeTab === 'editor' ? 'vd-mobile-active' : ''}`}>
						<div className="vd-panel-header">
							<div className="vd-panel-title">
								<span className={`vd-badge ${isSvgEditor ? 'vd-badge-svg' : ''}`}>
									{isSvgEditor ? "SVG" : "XML"}
								</span>
								<span>{isSvgEditor ? "SVG Source" : "Android Vector XML"}</span>
							</div>

							<div className="vd-toolbar">
								{/* Vice-Versa Swap Button */}
								<button
									type="button"
									className="vd-btn-ghost vd-btn-swap"
									onClick={swapViceVersa}
									title="Swap conversion mode (Vector XML ⇄ SVG)"
								>
									<span>⇄ Vice-Versa</span>
								</button>

								<button
									type="button"
									className={`vd-btn-ghost ${wordWrap ? 'vd-btn-active' : ''}`}
									onClick={() => setWordWrap(!wordWrap)}
									title={wordWrap ? "Word wrap is ON (always adapts to screen)" : "Word wrap is OFF"}
								>
									Wrap: {wordWrap ? "ON" : "OFF"}
								</button>
								<button type="button" className="vd-btn-ghost" onClick={loadSample} title="Load sample code">
									Sample
								</button>
								<button type="button" className="vd-btn-ghost" onClick={onDropzoneClick} title="Upload .xml or .svg file">
									Upload File
								</button>
								<button type="button" className="vd-btn-ghost" onClick={copyXmlToClipboard} title="Copy code">
									{copiedXml ? "Copied!" : "Copy"}
								</button>
								<button type="button" className="vd-btn-ghost" onClick={clearAll} title="Clear editor and preview">
									Clear
								</button>
							</div>
						</div>

						{/* CodeMirror XML / SVG Editor */}
						<div className="vd-editor-wrapper">
							<CodeMirror
								value={xmlContent}
								onChange={setXmlContent}
								extensions={editorExtensions}
								theme={vscodeDark}
								basicSetup={{
									lineNumbers: true,
									foldGutter: true,
									highlightActiveLine: true,
									autocompletion: true,
								}}
							/>
						</div>

						{/* Collapsible Resource Overrides (for VectorDrawable) */}
						{!isSvgEditor && (
							<details className="vd-resource-accordion">
								<summary className="vd-resource-summary">
									Android Resource Overrides (@color, @dimen)
								</summary>
								<div className="vd-resource-content">
									<CodeMirror
										value={xmlResource}
										onChange={setXmlResource}
										style={{ fontSize: "13px" }}
										extensions={editorExtensions}
										theme={vscodeDark}
									/>
									<p style={{ marginTop: '8px', fontSize: '0.78em', color: 'var(--vd-color-secondary-text)' }}>
										Use this block if your VectorDrawable references values like <code style={{ color: '#fff' }}>@color/accent</code> or <code style={{ color: '#fff' }}>@dimen/icon_size</code>.
									</p>
								</div>
							</details>
						)}

						{conversionError && (
							<div className="vd-error-msg">
								{conversionError}
							</div>
						)}
					</div>

					{/* Right Pane: Live Preview & Export */}
					<div className={`vd-pane vd-pane-preview ${activeTab === 'preview' ? 'vd-mobile-active' : ''}`}>
						<div className="vd-panel-header">
							<div className="vd-panel-title">
								<span className="vd-badge vd-badge-svg">PREVIEW</span>
								<span>Live Visual & Export</span>
								{vectorDrawableFile?.name && (
									<span style={{ fontSize: '0.8em', color: 'var(--vd-color-secondary-text)', marginLeft: '4px' }}>
										({vectorDrawableFile.name})
									</span>
								)}
							</div>

							<div className="vd-toolbar">
								<button type="button" className="vd-btn-ghost" onClick={cycleBgMode} title="Toggle background pattern">
									{bgLabel}
								</button>
								{transformedSvg && (
									<button type="button" className="vd-btn-ghost" onClick={clearAll} title="Clear preview">
										Reset
									</button>
								)}
							</div>
						</div>

						{/* Dropzone & Preview Display */}
						<div
							onDragEnter={dragEnter}
							onDragLeave={dragLeave}
							onDragOver={dragOver}
							onDrop={fileDrop}
							onClick={!transformedSvg ? onDropzoneClick : undefined}
							className={`vd-preview-box bg-${bgMode} ${dropzoneClassOfState(dragState)}`}
						>
							{transformedSvg ? (
								<div className="vd-preview-content">
									<div onClick={clearAll} className="text-button-icon" title="Clear upload">
										<ReactSVG src={getAssetUrl("close.svg")} />
									</div>
									<div className="vd-image">
										<SVG src={transformedSvg} width="100%" height="100%" title="Rendered Graphic" />
									</div>
								</div>
							) : (
								<div className="vd-preview-empty">
									<ReactSVG src={getAssetUrl("plus.svg")} />
									<p>Drop a <strong>.xml</strong> or <strong>.svg</strong> file here, click to browse, or paste code in the left editor.</p>
									<span style={{ fontSize: '0.8em', marginTop: '6px', color: 'var(--vd-color-primary)' }}>
										⚡ Auto-detects & converts XML ⇄ SVG
									</span>
								</div>
							)}
						</div>

						{/* Action Buttons: Download & Copy Both Formats */}
						<div className="vd-action-grid">
							<button
								type="button"
								onClick={downloadCurrentSvg}
								disabled={!transformedSvg}
								className="vd-btn-primary"
								title="Download SVG file"
							>
								<ReactSVG src={getAssetUrl("download-circular-button.svg")} />
								<span>Download SVG</span>
							</button>

							<button
								type="button"
								onClick={downloadCurrentXml}
								disabled={!transformedSvg}
								className="vd-btn-primary vd-btn-xml"
								title="Download Android VectorDrawable XML file"
							>
								<ReactSVG src={getAssetUrl("download-circular-button.svg")} />
								<span>Download XML</span>
							</button>

							<button
								type="button"
								onClick={copySvgToClipboard}
								disabled={!transformedSvg}
								className="vd-btn-secondary"
								title="Copy SVG markup to clipboard"
							>
								<span>{copiedSvg ? "✓ Copied SVG!" : "Copy SVG Code"}</span>
							</button>

							<button
								type="button"
								onClick={copyXmlToClipboard}
								disabled={!transformedSvg}
								className="vd-btn-secondary"
								title="Copy Android VectorDrawable XML markup to clipboard"
							>
								<span>{copiedXml ? "✓ Copied XML!" : "Copy Vector XML"}</span>
							</button>
						</div>
					</div>
				</div>

				{/* Footer with Interactive CLI Card & Credits */}
				<footer className="vd-footer">
					<div className="vd-cli-card">
						<div className="vd-cli-header">
							<div className="vd-cli-title-row">
								<span className="vd-badge">CLI</span>
								<span className="vd-cli-title">Command-Line Conversion</span>
							</div>
							<button
								type="button"
								className="vd-btn-ghost vd-cli-copy-btn"
								onClick={copyCliCommand}
								title="Copy CLI command"
							>
								{copiedCli ? "✓ Copied!" : "Copy"}
							</button>
						</div>
						<div
							className="vd-code-snippet"
							onClick={copyCliCommand}
							title="Click to copy CLI command"
						>
							<span className="vd-prompt">$</span>
							<span>npx</span>
							<span className="vd-cmd">vector-drawable-svg</span>
							<span className="vd-input">my-drawable.xml</span>
							<span className="vd-input">out.svg</span>
						</div>
					</div>

					<div className="vd-footer-bottom">
						<div className="vd-github">
							<a href="https://github.com/junksidetm/vector-drawable-nextjs" target="_blank" rel="noopener noreferrer" title="View on GitHub">
								<ReactSVG src={getAssetUrl("github.svg")} />
							</a>
						</div>

						<div className="vd-credits-pills">
							<span className="vd-credit-pill">
								Engine by <a href="https://github.com/seanghay" target="_blank" rel="noopener noreferrer">@seanghay</a>
							</span>
							<span className="vd-credit-pill">
								Enhanced by <a href="https://github.com/junksidetm" target="_blank" rel="noopener noreferrer">@junksidetm</a>
							</span>
						</div>
					</div>
				</footer>
			</div>
			</main>
			<CodeiumFooter />
		</>
	);
}
