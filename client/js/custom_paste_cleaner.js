/* OTAGO TinyMCE paste cleaner using Entwine
   - No global polling or long-lived listeners
   - Attaches per editor when the corresponding <textarea> matches Entwine
   - Cleans up when the field is removed
*/

(function ($) {
    var NS = 'OTAGO:paste-cleaner';
    var debug = typeof window.OTAGO_WYSIWYG_DEBUG === 'boolean' ? window.OTAGO_WYSIWYG_DEBUG : true;

    function log() {
        if (!debug) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[' + NS + ']');
        // eslint-disable-next-line no-console
        console.log.apply(console, args);
    }

    function warn() {
        if (!debug) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[' + NS + '][WARN]');
        // eslint-disable-next-line no-console
        console.warn.apply(console, args);
    }

    function error() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[' + NS + '][ERROR]');
        // eslint-disable-next-line no-console
        console.error.apply(console, args);
    }

    // Track editors we’ve already patched (by ID)
    if (!window.OTAGO_WYSIWYG_ATTACHED_EDITORS) {
        window.OTAGO_WYSIWYG_ATTACHED_EDITORS = new Set();
    }

    function installPasteCleaner(editor) {
        var id = editor && editor.id;
        if (!id) {
            warn('installPasteCleaner(): editor has no id, skipping');
            return;
        }
        if (window.OTAGO_WYSIWYG_ATTACHED_EDITORS.has(id)) {
            log('installPasteCleaner(): already attached to editor', id);
            return;
        }

        log('installPasteCleaner(): attaching PastePreProcess to editor', id);

        editor.on('PastePreProcess', function (e) {
            try {
                log('PastePreProcess fired; raw length:', e && e.content ? e.content.length : 0);
                var t0 = performance.now ? performance.now() : Date.now();
                var parser = new DOMParser();
                var html = e.content || '';

                // ---- Promote semantic styles to HTML tags ----
                var beforePromoteLen = html.length;
                html = html
                    .replace(/<(\w+)([^>]*)style\s*=\s*[^>]*font-weight\s*:\s*(bold|700)[^>]*>(.*?)<\/\1>/gis, function (_m, tag, attrs, weight, inner) {
                        return "<b>" + inner + "</b>";
                    })
                    .replace(/<(\w+)([^>]*)style\s*=\s*[^>]*font-style\s*:\s*italic[^>]*>(.*?)<\/\1>/gis, function (_m, tag, attrs, inner) {
                        return "<i>" + inner + "</i>";
                    })
                    .replace(/<(\w+)([^>]*)style\s*=\s*[^>]*text-decoration\s*:\s*underline[^>]*>(.*?)<\/\1>/gis, function (_m, tag, attrs, inner) {
                        return "<u>" + inner + "</u>";
                    });
                log('Promoted semantic styles; Δlen:', html.length - beforePromoteLen);

                // ---- Initial regex cleanup ----
                var beforeRegexLen = html.length;
                html = html
                    .replace(/\sclass=("|')?MsoNormal\1?/gi, '')
                    .replace(/mso-[^:;"]+:[^;"']+;?/gi, '')
                    .replace(/<\/?div[^>]*>/gi, ''); // flatten <div> tags
                log('Regex cleanup complete; Δlen:', html.length - beforeRegexLen);

                // ---- DOM-based processing ----
                var doc = parser.parseFromString(html, 'text/html');
                if (!doc || !doc.body) {
                    warn('DOMParser returned no body; skipping DOM steps');
                } else {
                    // Convert big font-sizes to <h1>, then strip style
                    var styledNodes = doc.body.querySelectorAll('[style]');
                    log('Elements with style:', styledNodes.length);
                    Array.prototype.forEach.call(styledNodes, function (el, i) {
                        var style = el.getAttribute('style') || '';
                        var fontSizeMatch = style.match(/font-size\s*:\s*([\d.]+)(pt|px)/i);

                        if (fontSizeMatch) {
                            var value = parseFloat(fontSizeMatch[1]);
                            var unit = fontSizeMatch[2].toLowerCase();
                            var sizePx = unit === 'pt' ? value * 1.33 : value;
                            if (sizePx >= 24) {
                                var wrapper = doc.createElement('h1');
                                el.parentNode.replaceChild(wrapper, el);
                                wrapper.appendChild(el);
                                log('Promoted to <h1> based on font-size ≈', sizePx, 'px (index', i, ')');
                            }
                        }
                        el.removeAttribute('style');
                    });

                    // Flatten spans
                    var spans = doc.body.querySelectorAll('span');
                    log('Flattening spans:', spans.length);
                    Array.prototype.forEach.call(spans, function (span) {
                        var parent = span.parentNode;
                        if (!parent) return;
                        while (span.firstChild) parent.insertBefore(span.firstChild, span);
                        parent.removeChild(span);
                    });

                    // Remove class attributes
                    var classed = doc.body.querySelectorAll('[class]');
                    log('Removing classes from elements:', classed.length);
                    Array.prototype.forEach.call(classed, function (el) {
                        el.removeAttribute('class');
                    });

                    // Remove empty leaf elements
                    var invisible = /[\u00a0\u200B-\u200F\u2028\u2029\u2060\s]/g;
                    var all = doc.body.querySelectorAll('*');
                    var removedLeaves = 0;
                    Array.prototype.forEach.call(all, function (el) {
                        var content = (el.textContent || '').replace(invisible, '');
                        if (!content && el.children.length === 0) {
                            el.remove();
                            removedLeaves++;
                        }
                    });
                    log('Removed empty leaves:', removedLeaves);

                    // Remove empty blocks
                    var blocks = doc.body.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6');
                    var removedBlocks = 0;
                    Array.prototype.forEach.call(blocks, function (el) {
                        var content = (el.textContent || '').replace(invisible, '').trim();
                        if (!content && el.children.length === 0) {
                            el.remove();
                            removedBlocks++;
                        }
                    });
                    log('Removed empty blocks:', removedBlocks);

                    // Strip tags like <o:p>
                    var opTags = doc.body.querySelectorAll('o\\:p');
                    if (opTags.length) {
                        Array.prototype.forEach.call(opTags, function (el) { el.remove(); });
                        log('Removed <o:p> tags:', opTags.length);
                    }

                    e.content = doc.body.innerHTML;
                    var t1 = performance.now ? performance.now() : Date.now();
                    log('Paste processing complete; output length:', e.content.length, 'time(ms):', (t1 - t0).toFixed(1));
                }
            } catch (ex) {
                error('Paste processing failed:', ex);
            }
        });

        window.OTAGO_WYSIWYG_ATTACHED_EDITORS.add(id);
        log('installPasteCleaner(): attached OK for editor', id);
    }

    /**
     * Attach to an HtmlEditorField when it appears.
     * We support both .htmleditor and .htmleditorfield just in case.
     */
    $.entwine('otago', function ($) {
        $('textarea.htmleditor, textarea.htmleditorfield').entwine({
            onmatch: function () {
                this._super();
                var id = this.attr('id');
                log('onmatch(): textarea matched with id', id);

                var self = this;

                function tryAttach() {
                    try {
                        if (!window.tinymce) {
                            warn('tryAttach(): tinymce not present yet');
                            return false;
                        }
                        var ed = window.tinymce.get(id);
                        if (ed) {
                            log('tryAttach(): editor found for', id);
                            installPasteCleaner(ed);
                            return true;
                        }
                        // If editor not ready yet, listen once for this specific editor via AddEditor
                        if (typeof window.tinymce.on === 'function') {
                            var handler = function (evt) {
                                var editor = evt && evt.editor;
                                if (editor && editor.id === id) {
                                    log('AddEditor captured for', id);
                                    installPasteCleaner(editor);
                                    // Detach this ad-hoc listener
                                    if (typeof window.tinymce.off === 'function') {
                                        window.tinymce.off('AddEditor', handler);
                                    }
                                }
                            };
                            // Store handler so we can clean it up if this field is removed before firing
                            self.data('otago-addeditor-handler', handler);
                            window.tinymce.on('AddEditor', handler);
                            log('tryAttach(): waiting for AddEditor event for', id);
                            return true; // we've set up the one-off hook
                        }
                        warn('tryAttach(): tinymce present but no .on API; cannot hook AddEditor');
                        return false;
                    } catch (ex) {
                        error('tryAttach(): failed', ex);
                        return false;
                    }
                }

                // Attempt immediate attach; if TinyMCE not ready yet, AddEditor listener will handle it
                tryAttach();
            },

            onunmatch: function () {
                // Clean up any AddEditor handler we may have attached for this field
                var handler = this.data('otago-addeditor-handler');
                if (handler && window.tinymce && typeof window.tinymce.off === 'function') {
                    window.tinymce.off('AddEditor', handler);
                    log('onunmatch(): removed AddEditor handler for', this.attr('id'));
                }
                this._super();
            }
        });
    });
})(jQuery);