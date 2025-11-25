function createPost() {
    const content = document.getElementById('postContent').value;
    if (!content.trim()) return;

    const feed = document.getElementById('feedList');

    const post = document.createElement('div');
    post.className = 'post-card';
    post.innerHTML = `
        <div class="post-header">
            <div class="avatar">Me</div>
            <div>
                <div style="font-weight: 600;">You</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Just now</div>
            </div>
        </div>
        <p style="margin-bottom: 1rem;">${content}</p>
        <div class="actions">
            <div class="action-item"><i class="far fa-heart"></i> 0</div>
            <div class="action-item"><i class="far fa-comment"></i> 0</div>
        </div>
    `;

    feed.insertBefore(post, feed.firstChild);
    document.getElementById('postContent').value = '';
}
