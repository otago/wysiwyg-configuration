/* Register a TinyMCE plugin that aggressively cleans pasted MS Word markup
   and promotes common inline styles to semantic tags (b/i/u). */

(function () {
    function register(editor) {
        editor.on('PastePreProcess', function (e) {
            var parser = new DOMParser();
            var html = e.content;

            // ---- Promote semantic styles to HTML tags ----
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

            // ---- Initial regex cleanup ----
            html = html
                .replace(/\sclass=("|')?MsoNormal\1?/gi, '')
                .replace(/mso-[^:;"]+:[^;"']+;?/gi, '');

            // ✅ Remove <div> tags but keep their content
            html = html.replace(/<\/?div[^>]*>/gi, '');

            // ---- DOM-based processing ----
            var doc = parser.parseFromString(html, 'text/html');

            // Inspect inline style and convert big font-sizes to headings; then remove style
            Array.prototype.forEach.call(doc.body.querySelectorAll('[style]'), function (el) {
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
                    }
                }

                el.removeAttribute('style');
            });

            // Flatten <span> tags but keep content
            Array.prototype.forEach.call(doc.body.querySelectorAll('span'), function (span) {
                var parent = span.parentNode;
                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                parent.removeChild(span);
            });

            // Remove all class attributes
            Array.prototype.forEach.call(doc.body.querySelectorAll('[class]'), function (el) {
                el.removeAttribute('class');
            });

            // Remove empty tags (including those with only invisible characters or &nbsp;)
            var invisibleCharsRegex = /[\u00a0\u200B-\u200F\u2028\u2029\u2060\s]/g;
            Array.prototype.forEach.call(doc.body.querySelectorAll('*'), function (el) {
                var content = (el.textContent || '').replace(invisibleCharsRegex, '');
                if (!content && el.children.length === 0) {
                    el.remove();
                }
            });

            // Remove empty block elements again defensively
            Array.prototype.forEach.call(doc.body.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6'), function (el) {
                var content = (el.textContent || '').replace(invisibleCharsRegex, '').trim();
                if (!content && el.children.length === 0) {
                    el.remove();
                }
            });

            // Strip tags like <o:p> and others
            Array.prototype.forEach.call(doc.body.querySelectorAll('o\\:p'), function (el) {
                el.remove();
            });

            // Assign cleaned HTML back to TinyMCE
            e.content = doc.body.innerHTML;
        });
    }

    function ensurePlugin() {
        if (!window.tinymce || !window.tinymce.PluginManager) return;
        if (window.tinymce.PluginManager.plugins['custom_paste_cleaner']) return;
        window.tinymce.PluginManager.add('custom_paste_cleaner', function (editor) {
            register(editor);
            return {};
        });
    }

    // Try immediately (admin often has TinyMCE ready), then also on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensurePlugin);
    } else {
        ensurePlugin();
    }
})();
