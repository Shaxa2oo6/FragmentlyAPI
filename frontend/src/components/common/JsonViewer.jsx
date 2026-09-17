import React from 'react';

function tokenize(json) {
  const tokens = [];
  const regex =
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(json))) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;

    if (start > lastIndex) {
      tokens.push({ type: 'plain', value: json.slice(lastIndex, start) });
    }

    let type = 'string';
    if (/^"/.test(value)) {
      type = value.endsWith(':') ? 'key' : 'string';
    } else if (/^(?:true|false)$/.test(value)) {
      type = 'boolean';
    } else if (/^null$/.test(value)) {
      type = 'null';
    } else {
      type = 'number';
    }

    tokens.push({ type, value });
    lastIndex = end;
  }

  if (lastIndex < json.length) {
    tokens.push({ type: 'plain', value: json.slice(lastIndex) });
  }

  return tokens;
}

const colorMap = {
  key: 'text-sky-300',
  string: 'text-emerald-300',
  number: 'text-amber-300',
  boolean: 'text-teal-300',
  null: 'text-red-400',
  plain: 'text-gray-400',
};

export default function JsonViewer({ data, className = '' }) {
  const json = JSON.stringify(data, null, 2);

  return (
    <pre
      className={`p-4 rounded-2xl bg-gray-950 font-mono text-xs overflow-x-auto border border-gray-800 max-h-80 overflow-y-auto leading-relaxed ${className}`}
    >
      <code>
        {tokenize(json).map((token, i) => (
          <span key={i} className={colorMap[token.type]}>
            {token.value}
          </span>
        ))}
      </code>
    </pre>
  );
}
