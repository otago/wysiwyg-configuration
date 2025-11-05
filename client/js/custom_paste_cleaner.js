/* OTAGO TinyMCE paste cleaner with robust init, safe plugin check, and detailed logging */

(function () {
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

    // Keep track of whether we defined the plugin and which editors we've patched
    if (!window.OTAGO_WYSIWYG_ATTACHED_EDITORS) {
        window.OTAGO_WYSIWYG_ATTACHED_EDITORS = new Set();
    }

    /* ------------------------------
       The actual paste cleaning logic
    --------------------------------*/
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

    /* ------------------------------
       Define plugin (future editors)
    --------------------------------*/
    function definePlugin() {
        if (!window.tinymce || !window.tinymce.PluginManager) {
            warn('definePlugin(): TinyMCE or PluginManager missing');
            return false;
        }

        if (window.OTAGO_WYSIWYG_PLUGIN_DEFINED) {
            log('definePlugin(): already defined (sentinel)');
            return true;
        }

        window.tinymce.PluginManager.add('custom_paste_cleaner', function (editor) {
            log('Plugin factory invoked for editor', editor && editor.id);
            // Even when enabled via PHP config, ensure handler is attached:
            installPasteCleaner(editor);
            return {}; // TinyMCE plugin API expects a plugin object
        });

        window.OTAGO_WYSIWYG_PLUGIN_DEFINED = true;
        log('Plugin definition registered with TinyMCE PluginManager (sentinel set).');
        return true;
    }

    /* --------------------------------------------
       Hook TinyMCE lifecycle + patch existing
    ---------------------------------------------*/
    function hookAddEditor() {
        if (!window.tinymce || typeof window.tinymce.on !== 'function') {
            warn('hookAddEditor(): tinymce.on missing');
            return false;
        }
        window.tinymce.on('AddEditor', function (evt) {
            var ed = evt && evt.editor;
            log('tinymce AddEditor fired; editor id:', ed && ed.id);
            // Ensure our plugin is defined (for future), then attach to this editor now
            definePlugin();
            if (ed) installPasteCleaner(ed);
        });
        log('hookAddEditor(): listener attached.');
        return true;
    }

    function patchExistingEditors() {
        try {
            var eds = (window.tinymce && window.tinymce.editors) || [];
            if (!eds || !eds.length) {
                log('patchExistingEditors(): none found');
                return;
            }
            log('patchExistingEditors(): found editors', eds.map(function (e) { return e.id; }));
            eds.forEach(function (ed) {
                installPasteCleaner(ed);
            });
        } catch (ex) {
            warn('patchExistingEditors(): failed', ex);
        }
    }

    function retryUntilReady(maxMs) {
        var start = Date.now();
        var delay = 100; // ms
        var maxDelay = 2000;

        (function tick() {
            var elapsed = Date.now() - start;
            if (elapsed > maxMs) {
                warn('retryUntilReady(): timed out after', maxMs, 'ms');
                return;
            }
            var hasTMCE = !!(window.tinymce && window.tinymce.PluginManager);
            if (hasTMCE) {
                log('retryUntilReady(): TinyMCE present — defining plugin, hooking AddEditor, patching existing.');
                definePlugin();
                hookAddEditor();
                patchExistingEditors();
                return;
            }
            delay = Math.min(maxDelay, Math.round(delay * 1.5));
            log('retryUntilReady(): TinyMCE not ready; retrying in', delay, 'ms');
            setTimeout(tick, delay);
        })();
    }

    /* --------------------------------------------
       Entry point
    ---------------------------------------------*/
    function init() {
        log('init(): starting');

        var defined = definePlugin();
        var hooked = hookAddEditor();

        if (!defined || !hooked) {
            retryUntilReady(15000); // up to 15s
        } else {
            // TinyMCE is already ready—patch any editors that are already on the page
            patchExistingEditors();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            log('DOMContentLoaded -> init()');
            init();
        });
    } else {
        log('Document already ready -> init()');
        init();
    }
})();
