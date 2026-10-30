FROM nginxinc/nginx-unprivileged:alpine
USER root
RUN apk upgrade --no-cache
COPY index.html /usr/share/nginx/html/index.html
USER nginx
EXPOSE 8080
