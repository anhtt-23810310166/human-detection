FROM nginx:alpine

# Xóa trang index mặc định của Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copy toàn bộ code Frontend vào Nginx
COPY . /usr/share/nginx/html/

EXPOSE 80
